import { decodificarPolyline } from '../../utils/polyline';
import type { Coordenada, ResultadoRuta } from '../types';
import { apiFetch } from './client';

/**
 * Servicio de rutas: consume `POST /routes` del backend (NestJS → Valhalla).
 *
 * Nota para el equipo: hoy el backend usa `costing: 'auto'`. Para OmniTravel
 * corresponde `wheelchair` o `pedestrian` de Valhalla; cuando el backend lo
 * actualice, este contrato no cambia.
 */

interface RespuestaValhalla {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: { shape?: string }[];
  };
}

export async function calcularRutaAccesible(
  origen: Coordenada,
  destino: Coordenada,
): Promise<ResultadoRuta> {
  const datos = await apiFetch<RespuestaValhalla>('/routes', {
    method: 'POST',
    body: JSON.stringify({
      origin: [origen.latitude, origen.longitude],
      destination: [destino.latitude, destino.longitude],
    }),
  });

  const resumen = datos.trip?.summary;
  if (!resumen || resumen.length === undefined || resumen.time === undefined) {
    throw new Error('El motor de ruteo devolvió una respuesta inesperada.');
  }

  let coordenadas: Coordenada[] | undefined;
  const shape = datos.trip?.legs?.[0]?.shape;
  if (shape) {
    try {
      coordenadas = decodificarPolyline(shape, 6);
    } catch {
      // Si la geometría no se puede decodificar, la ruta sigue siendo válida
      // (distancia y duración); simplemente no se dibuja la línea.
      coordenadas = undefined;
    }
  }

  return {
    distanciaKm: resumen.length,
    duracionMin: Math.round(resumen.time / 60),
    coordenadas,
  };
}
