import { HttpStatus } from '@nestjs/common';
import { errorDominio } from '../common/errores';

/**
 * Cliente HTTP de Valhalla con tiempo límite y reintentos (auditoría, riesgo 4).
 *
 * - Cada intento se corta a los `tiempoLimiteMs` (12 s por defecto).
 * - Se reintenta solo lo transitorio: fallas de red, tiempo agotado, 429 y 5xx,
 *   con espera creciente (0,5 s, 1 s…). Un 400 de Valhalla («no hay camino»)
 *   no se reintenta: repetirlo daría la misma respuesta.
 * - Si el servicio sigue sin responder se devuelve 503 RUTEO_NO_DISPONIBLE
 *   con un mensaje de contingencia; la app entonces prueba el respaldo
 *   (Valhalla público directo) y, si tampoco responde, lo informa al usuario.
 */
export interface OpcionesValhalla {
  intentos?: number;
  tiempoLimiteMs?: number;
  esperaBaseMs?: number;
  fetchFn?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
}

const dormirReal = (ms: number) =>
  new Promise<void>((listo) => setTimeout(listo, ms));

function transitorio(estado: number): boolean {
  return estado === 429 || estado >= 500;
}

export async function consultarValhalla(
  url: string,
  solicitud: unknown,
  opciones: OpcionesValhalla = {},
): Promise<unknown> {
  const intentos = opciones.intentos ?? 3;
  const tiempoLimiteMs = opciones.tiempoLimiteMs ?? 12_000;
  const esperaBaseMs = opciones.esperaBaseMs ?? 500;
  const fetchFn = opciones.fetchFn ?? fetch;
  const dormir = opciones.dormir ?? dormirReal;

  for (let intento = 1; intento <= intentos; intento++) {
    let respuesta: Response;
    try {
      respuesta = await fetchFn(`${url}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitud),
        signal: AbortSignal.timeout(tiempoLimiteMs),
      });
    } catch {
      // Red caída o tiempo agotado: se reintenta.
      if (intento < intentos) {
        await dormir(esperaBaseMs * intento);
        continue;
      }
      break;
    }

    if (respuesta.ok) {
      return respuesta.json();
    }
    if (!transitorio(respuesta.status)) {
      throw errorDominio(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'RUTA_NO_ENCONTRADA',
        'No encontramos una ruta accesible entre esos puntos. Prueba con otro origen o con menos restricciones.',
      );
    }
    if (intento < intentos) {
      await dormir(esperaBaseMs * intento);
    }
  }

  throw errorDominio(
    HttpStatus.SERVICE_UNAVAILABLE,
    'RUTEO_NO_DISPONIBLE',
    'El servicio de rutas no responde en este momento. Intenta de nuevo en unos minutos.',
  );
}
