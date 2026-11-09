import {
  advertenciasDeEscaleras,
  normalizarRespuestaRuta,
} from '../../utils/ruta';
import {
  combinarPuntos,
  puntosParaEvitar,
  rutasSonDistintas,
} from '../../utils/cambioRuta';
import type { Coordenada, ResultadoRuta, RestriccionesRuta } from '../types';
import { ApiError, apiFetch } from './client';

/**
 * Servicio de rutas accesibles (Proceso 2).
 *
 * Vía primaria: `POST /routes` del backend del equipo (NestJS → Valhalla;
 * documento `backend/src/routing/valhalla-payload.ts`).
 *
 * Respaldo para demotras/demos sin backend desplegado: la MISMA solicitud
 * peatonal se envía al servidor público Valhalla de OpenStreetMap con las
 * opciones del perfil (types `wheelchair`/`blind`, penalización de escaleras
 * de 3600 s y ascensores no penalizados). El payload es idéntico al del
 * backend a propósito: al desplegar el backend el contrato no cambia.
 */
const VALHALLA_PUBLICO = 'https://valhalla1.openstreetmap.de/route';
const TIMEOUT_BACKEND_MS = 4000;
const TIMEOUT_VALHALLA_MS = 20000;

interface SolicitudValhalla {
  locations: { lat: number; lon: number }[];
  costing: 'pedestrian';
  costing_options: { pedestrian: Record<string, string | number> };
  units: 'kilometers';
  language: 'es-ES';
  /**
   * `alternates: 1` → hasta 2 rutas (principal + alternativa): la app las
   * alterna con «Recalcular ruta» para no repetir el mismo trayecto. Espejo
   * exacto de la decisión documentada en el backend.
   */
  alternates: 1;
  /** «Cambiar ruta»: puntos de la ruta anterior a evitar. */
  exclude_locations?: { lat: number; lon: number }[];
}

/** Espejo fiel de `construirSolicitudValhalla` del backend. */
function construirSolicitudValhalla(
  origen: Coordenada,
  destino: Coordenada,
  restricciones: RestriccionesRuta,
  evitar: Coordenada[] = [],
): { solicitud: SolicitudValhalla; advertenciasMotor: string[] } {
  const opciones: Record<string, string | number> = {};
  const advertenciasMotor: string[] = [];

  if (restricciones.perfil === 'silla_de_ruedas') {
    opciones.type = 'wheelchair';
  } else if (restricciones.perfil === 'visual') {
    opciones.type = 'blind';
  }

  if (restricciones.avoidStairs) {
    opciones.step_penalty = 3600;
  }

  if (restricciones.requireElevator) {
    opciones.elevator_penalty = 0;
  }

  if (
    restricciones.preferSoundTrafficLights &&
    restricciones.perfil !== 'visual'
  ) {
    advertenciasMotor.push(
      'La preferencia por semáforos sonoros se aplica con el perfil visual (narración asistida de cruces).',
    );
  }

  return {
    solicitud: {
      locations: [
        { lat: origen.latitude, lon: origen.longitude },
        { lat: destino.latitude, lon: destino.longitude },
      ],
      costing: 'pedestrian',
      costing_options: { pedestrian: opciones },
      units: 'kilometers',
      language: 'es-ES',
      alternates: 1,
      ...(evitar.length > 0
        ? {
            exclude_locations: evitar.map((punto) => ({
              lat: punto.latitude,
              lon: punto.longitude,
            })),
          }
        : {}),
    },
    advertenciasMotor,
  };
}

/**
 * Cierra el contrato del front sobre TODAS las rutas (principal y
 * alternativa): advertencias del motor, del backend y las derivadas de
 * escaleras detectadas en la narración (RNF-14).
 */
function cerrarAdvertencias(
  ruta: ResultadoRuta,
  restricciones: RestriccionesRuta,
  advertenciasMotor: string[] = [],
): ResultadoRuta {
  const cerrada: ResultadoRuta = {
    ...ruta,
    advertencias: [
      ...advertenciasMotor,
      ...(ruta.advertencias ?? []),
      ...advertenciasDeEscaleras(ruta.pasos ?? [], restricciones),
    ],
  };
  if (cerrada.alternativa) {
    // La alternativa no repite los avisos de semáforos de la principal.
    cerrada.alternativa = {
      ...cerrada.alternativa,
      advertencias: [
        ...(cerrada.alternativa.advertencias ?? []),
        ...advertenciasDeEscaleras(
          cerrada.alternativa.pasos ?? [],
          restricciones,
        ),
      ],
    };
  }
  return cerrada;
}

async function rutaConValhallaPublico(
  origen: Coordenada,
  destino: Coordenada,
  restricciones: RestriccionesRuta,
  evitar: Coordenada[] = [],
): Promise<ResultadoRuta> {
  const { solicitud, advertenciasMotor } = construirSolicitudValhalla(
    origen,
    destino,
    restricciones,
    evitar,
  );

  const controlador = new AbortController();
  const temporizador = setTimeout(
    () => controlador.abort(),
    TIMEOUT_VALHALLA_MS,
  );
  try {
    const respuesta = await fetch(VALHALLA_PUBLICO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitud),
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      let detalle = '';
      try {
        const cuerpo = (await respuesta.json()) as { error?: unknown };
        if (
          typeof cuerpo?.error === 'string' &&
          /no suitable|no path|no edge/i.exec(cuerpo.error)
        ) {
          detalle =
            'No encontramos una ruta peatonal para esos puntos (el destino podría no estar conectado a veredas).';
        }
      } catch {
        // Cuerpo no legible: se conserva el mensaje genérico.
      }
      throw new Error(
        detalle ||
          `El motor de ruteo respondió con estado ${respuesta.status}.`,
      );
    }

    const crudo = (await respuesta.json()) as unknown;
    return cerrarAdvertencias(
      normalizarRespuestaRuta(crudo),
      restricciones,
      advertenciasMotor,
    );
  } finally {
    clearTimeout(temporizador);
  }
}

export async function calcularRutaAccesible(
  origen: Coordenada,
  destino: Coordenada,
  restricciones?: RestriccionesRuta,
  evitar: Coordenada[] = [],
): Promise<ResultadoRuta> {
  const restriccionesEfectivas: RestriccionesRuta = restricciones ?? {};

  // (1) Backend del equipo con timeout corto: si no está desplegado falla
  // rápido para no arrastrar la espera hasta la reserva.
  try {
    const datos = await apiFetch<unknown>(
      '/routes',
      {
        method: 'POST',
        body: JSON.stringify({
          origin: [origen.latitude, origen.longitude],
          destination: [destino.latitude, destino.longitude],
          restrictions: restriccionesEfectivas,
          ...(evitar.length > 0
            ? {
                avoid: evitar.map((punto) => [punto.latitude, punto.longitude]),
              }
            : {}),
        }),
      },
      TIMEOUT_BACKEND_MS,
    );
    return cerrarAdvertencias(
      normalizarRespuestaRuta(datos),
      restriccionesEfectivas,
    );
  } catch (error) {
    // Sesión vencida: el cliente ya cerró la sesión; no se disfraza con la
    // reserva (la ruta exige cuenta).
    if (error instanceof ApiError && error.status === 401) {
      throw error;
    }
    // Backend ausente (típico en demo local): continúa con la reserva.
  }

  // (2) Respaldo: Valhalla público con el mismo contrato de accesibilidad.
  try {
    return await rutaConValhallaPublico(
      origen,
      destino,
      restriccionesEfectivas,
      evitar,
    );
  } catch (error) {
    const mensaje = (error as Error)?.message;
    if (mensaje && !/abort/i.exec(mensaje)) {
      // Errores ya accionables de la reserva (sin ruta, sin red del motor).
      throw new Error(mensaje);
    }
    throw new Error(
      'No se pudo calcular la ruta. Verifica tu conexión a internet e inténtalo de nuevo.',
    );
  }
}

/** Ruta distinta encontrada por «Cambiar ruta» y los puntos que evita. */
export interface RutaDiferente {
  ruta: ResultadoRuta;
  evitar: Coordenada[];
}

/**
 * «Cambiar ruta»: busca un camino accesible distinto del que se muestra.
 * Prueba evitando varios puntos intermedios de la ruta actual, luego solo el
 * punto medio y, por último, la alternativa que propuso el motor. Devuelve
 * null si no existe otro camino accesible para ese trayecto.
 */
export async function buscarRutaDiferente(
  origen: Coordenada,
  destino: Coordenada,
  restricciones: RestriccionesRuta,
  actual: ResultadoRuta,
  evitarPrevios: Coordenada[] = [],
): Promise<RutaDiferente | null> {
  const coordenadas = actual.coordenadas ?? [];
  const intentos = [
    puntosParaEvitar(coordenadas, [0.3, 0.5, 0.7]),
    puntosParaEvitar(coordenadas, [0.5]),
  ].filter((puntos) => puntos.length > 0);

  for (const puntos of intentos) {
    const evitar = combinarPuntos(evitarPrevios, puntos);
    try {
      const ruta = await calcularRutaAccesible(
        origen,
        destino,
        restricciones,
        evitar,
      );
      if (rutasSonDistintas(coordenadas, ruta.coordenadas ?? [])) {
        return { ruta, evitar };
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw error;
      }
      // Sin camino evitando esos puntos: se prueba con menos.
    }
  }

  const alternativa = actual.alternativa;
  if (
    alternativa &&
    rutasSonDistintas(coordenadas, alternativa.coordenadas ?? [])
  ) {
    return { ruta: alternativa, evitar: evitarPrevios };
  }
  return null;
}
