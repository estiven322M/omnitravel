import type {
  IconName,
  PasoRuta,
  ResultadoRuta,
  RestriccionesRuta,
} from '../services/types';
import type { NecesidadAccesibilidad } from '../store/profileStore';
import type { FiltroId } from './filters';
import { decodificarPolyline } from './polyline';

/**
 * Lógica pura del Proceso 2 (rutas accesibles): derivación de restricciones
 * desde el perfil, mapeo de maniobras a íconos, vigencia de datos (RNF-27) y
 * normalización de la respuesta del motor de ruteo. Separada de pantallas y
 * servicios para poder probarla con Jest.
 */

/** Antigüedad máxima de los datos de accesibilidad antes de advertir (RNF-27). */
export const DIAS_DATOS_VIGENTES = 60;

/**
 * Deriva las restricciones de ruteo del perfil de accesibilidad local.
 *
 * - Necesidades motrices → perfil `silla_de_ruedas` (Valhalla ajusta
 *   distancia, velocidad y penalización de escaleras) + evitar escaleras +
 *   favorecer ascensores.
 * - Necesidad visual → perfil `visual` (narración asistida de cruces y
 *   semáforos) + preferir semáforos sonoros.
 * - Los filtros activos (U05) también cuentan como preferencias explícitas
 *   del trayecto aunque el perfil no declare la necesidad.
 */
export function restriccionesDesdePerfil(
  necesidades: NecesidadAccesibilidad[],
  filtrosActivos: FiltroId[] = [],
): RestriccionesRuta {
  const motriz =
    necesidades.includes('movilidad_reducida') ||
    necesidades.includes('silla_de_ruedas');

  if (motriz) {
    return {
      perfil: 'silla_de_ruedas',
      avoidStairs: true,
      requireElevator: true,
    };
  }

  if (necesidades.includes('visual')) {
    return {
      perfil: 'visual',
      preferSoundTrafficLights: true,
    };
  }

  const restricciones: RestriccionesRuta = {};
  if (filtrosActivos.includes('sin_escalones')) {
    restricciones.avoidStairs = true;
  }
  if (filtrosActivos.includes('ascensor_amplio')) {
    restricciones.requireElevator = true;
  }
  if (
    filtrosActivos.includes('semaforos_sonoros') ||
    filtrosActivos.includes('piso_podotactil')
  ) {
    restricciones.preferSoundTrafficLights = true;
  }
  return restricciones;
}

/**
 * Ícono direccional para un tipo de maniobra Valhalla
 * (ver catálogo de tipos: kStart = 1 … kBuildingExit = 43).
 */
export function iconoDeManeuver(tipo: number): IconName {
  switch (tipo) {
    case 1: // kStart
    case 2: // kStartRight
    case 3: // kStartLeft
      return 'navigate-circle-outline';
    case 4: // kDestination
    case 5: // kDestinationRight
    case 6: // kDestinationLeft
      return 'flag-outline';
    case 9: // kSlightRight
      return 'return-up-forward-outline';
    case 11: // kSharpRight
      return 'return-down-forward-outline';
    case 16: // kSlightLeft
      return 'return-up-back-outline';
    case 14: // kSharpLeft
      return 'return-down-back-outline';
    case 12: // kUturnRight
    case 13: // kUturnLeft
      return 'refresh-outline';
    case 26: // kRoundaboutEnter
    case 27: // kRoundaboutExit
      return 'sync-circle-outline';
    case 39: // kElevatorEnter
      return 'swap-vertical-outline';
    case 40: // kStepsEnter
      return 'trending-up-outline';
    case 10: // kRight
    case 18: // kRampRight
    case 20: // kExitRight
    case 23: // kStayRight
    case 37: // kMergeRight
      return 'arrow-forward-circle-outline';
    case 15: // kLeft
    case 19: // kRampLeft
    case 21: // kExitLeft
    case 24: // kStayLeft
    case 38: // kMergeLeft
      return 'arrow-back-circle-outline';
    case 7: // kBecomes
    case 8: // kContinue
    case 17: // kRampStraight
    case 22: // kStayStraight
    case 25: // kMerge
      return 'arrow-up-circle-outline';
    default:
      return 'ellipse-outline';
  }
}

/**
 * Detecta escaleras en la narración de la ruta (los motores las mencionan en
 * la instrucción: "escalera(s)" en es / "stairs" en en) y compone advertencias
 * accionables sin duplicar avisos (RNF-12: errores visibles y objetivo).
 */
export function advertenciasDeEscaleras(
  pasos: PasoRuta[],
  restricciones: RestriccionesRuta,
): string[] {
  const tramos = pasos.filter((paso) =>
    /escal\w+|stairs/i.test(paso.instruccion),
  ).length;
  if (tramos === 0) {
    return [];
  }
  const aviso =
    tramos === 1
      ? 'Un tramo de la ruta incluye escaleras.'
      : `${tramos} tramos de la ruta incluyen escaleras.`;
  if (restricciones.avoidStairs || restricciones.perfil === 'silla_de_ruedas') {
    return [
      `${aviso} El motor aplicó la penalización de escaleras del perfil, pero no encontró alternativa completa: revisa los pasos marcados.`,
    ];
  }
  return [aviso];
}

/**
 * true cuando los datos de accesibilidad no son confiables: fecha inválida,
 * ausente o con más de `diasMax` días de antigüedad (RNF-27).
 */
export function datosDesactualizados(
  ultimaVerificacion: string | null | undefined,
  diasMax: number = DIAS_DATOS_VIGENTES,
): boolean {
  if (!ultimaVerificacion) {
    return true;
  }
  const milisegundos = new Date(ultimaVerificacion).getTime();
  if (Number.isNaN(milisegundos)) {
    return true;
  }
  const dias = (Date.now() - milisegundos) / (1000 * 60 * 60 * 24);
  return dias > diasMax;
}

/** Decodifica la geometría polyline6 sin romper la ruta si viene corrupta. */
function decodificarSiPuede(shape: unknown): ResultadoRuta['coordenadas'] {
  if (typeof shape !== 'string' || shape === '') {
    return undefined;
  }
  try {
    return decodificarPolyline(shape, 6);
  } catch {
    return undefined;
  }
}

function normalizarPasos(crudos: unknown): PasoRuta[] {
  if (!Array.isArray(crudos)) {
    return [];
  }
  return crudos
    .filter((paso): paso is Record<string, unknown> => Boolean(paso))
    .map((paso) => ({
      tipo: typeof paso.tipo === 'number' ? paso.tipo : 0,
      instruccion: typeof paso.instruccion === 'string' ? paso.instruccion : '',
      distanciaKm: typeof paso.distanciaKm === 'number' ? paso.distanciaKm : 0,
    }))
    .filter((paso) => paso.instruccion !== '');
}

function normalizarAdvertencias(crudas: unknown): string[] {
  if (!Array.isArray(crudas)) {
    return [];
  }
  return crudas.filter(
    (aviso): aviso is string => typeof aviso === 'string' && aviso !== '',
  );
}

/** Forma de un `trip` crudo de Valhalla (resumen + tramos). */
interface TripValhalla {
  summary?: { length?: unknown; time?: unknown };
  legs?: {
    shape?: string;
    maneuvers?: { type?: number; instruction?: string; length?: number }[];
  }[];
}

/** Extrae el `trip` de una entrada de `alternates` (envuelve su propio trip) o la entrada misma. */
function tripDeAlternativa(entrada: unknown): TripValhalla | undefined {
  if (!entrada || typeof entrada !== 'object') {
    return undefined;
  }
  const conTrip = (entrada as { trip?: unknown }).trip;
  const trip = conTrip ?? entrada;
  if (!trip || typeof trip !== 'object') {
    return undefined;
  }
  const resumen = (trip as TripValhalla).summary;
  return typeof resumen?.length === 'number' &&
    typeof resumen?.time === 'number'
    ? (trip as TripValhalla)
    : undefined;
}

/** Normaliza un `trip` crudo de Valhalla (ruta principal o alternativa). */
function normalizarTripValhalla(
  trip: TripValhalla | undefined,
  advertencias: string[],
): ResultadoRuta {
  const longitud = trip?.summary?.length;
  const tiempo = trip?.summary?.time;
  if (typeof longitud !== 'number' || typeof tiempo !== 'number') {
    throw new Error('El motor de ruteo devolvió una respuesta inesperada.');
  }

  const pasosCrudos = (trip?.legs ?? []).flatMap((tramo) =>
    (tramo.maneuvers ?? []).map((maniobra) => ({
      tipo: maniobra.type ?? 0,
      instruccion: maniobra.instruction ?? '',
      distanciaKm: maniobra.length ?? 0,
    })),
  );

  return {
    distanciaKm: longitud,
    duracionMin: Math.round(tiempo / 60),
    coordenadas: decodificarSiPuede(trip?.legs?.[0]?.shape),
    pasos: normalizarPasos(pasosCrudos),
    advertencias: normalizarAdvertencias(advertencias),
  };
}

/**
 * Normaliza la respuesta del motor de ruteo al contrato del front.
 *
 * Acepta el contrato normalizado de OmniTravel (`distanciaKm`, `pasos`,
 * `advertencias`) y, mientras un despliegue del backend no lo aplique, el
 * formato crudo de Valhalla (`trip.summary` + `trip.legs[].maneuvers`).
 * En ambos formatos adjunta `alternativa` cuando el motor la incluye.
 */
export function normalizarRespuestaRuta(crudo: unknown): ResultadoRuta {
  const datos = (crudo ?? {}) as {
    distanciaKm?: unknown;
    duracionMin?: unknown;
    perfil?: unknown;
    shape?: unknown;
    pasos?: unknown;
    advertencias?: unknown;
    warnings?: unknown;
    /** Contrato backend: alternativa ya normalizada. */
    alternativa?: unknown;
    alternative?: unknown;
    /** Valhalla crudo: rutas alternativas (cada entrada trae su `trip`). */
    alternates?: unknown[];
    alternatives?: unknown[];
    trip?: TripValhalla;
  };

  if (
    typeof datos.distanciaKm === 'number' &&
    typeof datos.duracionMin === 'number'
  ) {
    const crudaAlternativa = datos.alternativa ?? datos.alternative;
    return {
      distanciaKm: datos.distanciaKm,
      duracionMin: datos.duracionMin,
      coordenadas: decodificarSiPuede(datos.shape),
      perfil: typeof datos.perfil === 'string' ? datos.perfil : undefined,
      pasos: normalizarPasos(datos.pasos),
      advertencias: normalizarAdvertencias(datos.advertencias),
      // La alternativa se re-normaliza con la misma función (contrato o crudo);
      // un elemento malformado se omite sin romper la ruta principal.
      alternativa: (() => {
        try {
          return crudaAlternativa == null
            ? undefined
            : normalizarRespuestaRuta(crudaAlternativa);
        } catch {
          return undefined;
        }
      })(),
    };
  }

  // Formato crudo de Valhalla (compatibilidad de despliegue).
  const ruta = normalizarTripValhalla(
    datos.trip,
    normalizarAdvertencias(datos.warnings),
  );

  // `alternates: 1` en Valhalla → 2 rutas (principal + 1 alternativa).
  const crudas: unknown[] = [
    ...(Array.isArray(datos.alternates) ? datos.alternates : []),
    ...(Array.isArray(datos.alternatives) ? datos.alternatives : []),
  ];
  const tripAlternativo = crudas
    .map(tripDeAlternativa)
    .find((trip) => trip !== undefined);

  if (tripAlternativo) {
    try {
      ruta.alternativa = normalizarTripValhalla(tripAlternativo, []);
    } catch {
      // Alternativa malformada: se entrega la ruta principal intacta.
    }
  }

  return ruta;
}
