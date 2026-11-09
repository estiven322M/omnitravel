import type { Coordenada, Poi, ReporteResumen } from '../services/types';
import { distanciaKm } from './geo';
import { longitudesAcumuladas, proyectarEnRuta } from './progresoRuta';

/** Una barrera de la ruta más cerca que esto se considera «en el trayecto». */
export const RADIO_BARRERA_EN_RUTA_M = 40;
/** Distancia a la que se alerta durante la navegación (modal S02). */
export const RADIO_ALERTA_BARRERA_M = 60;

export interface BarreraUbicada {
  id: string;
  nombre: string;
  descripcion: string;
  punto: Coordenada;
}

/**
 * Barreras críticas con su ubicación (la del lugar reportado). El destino se
 * excluye: llegar a él es el objetivo, su estado ya se ve en el detalle.
 */
export function ubicarBarreras(
  barreras: readonly ReporteResumen[],
  poiPorId: (id: string) => Poi | undefined,
  idDestino?: string,
): BarreraUbicada[] {
  const vistas = new Set<string>();
  const ubicadas: BarreraUbicada[] = [];
  for (const barrera of barreras) {
    if (!barrera.esCritico || barrera.poiId === idDestino) {
      continue;
    }
    const poi = poiPorId(barrera.poiId);
    if (!poi || vistas.has(poi.id)) {
      continue;
    }
    vistas.add(poi.id);
    ubicadas.push({
      id: barrera.id,
      nombre: poi.nombre,
      descripcion: barrera.descripcion?.trim() || 'Barrera crítica reportada',
      punto: { latitude: poi.latitud, longitude: poi.longitud },
    });
  }
  return ubicadas;
}

/** Barreras por las que pasa (o casi) el trayecto calculado. */
export function barrerasEnRuta(
  coordenadas: readonly Coordenada[],
  barreras: readonly BarreraUbicada[],
  radioM = RADIO_BARRERA_EN_RUTA_M,
): BarreraUbicada[] {
  if (coordenadas.length < 2) {
    return [];
  }
  const lista = [...coordenadas];
  const acumuladas = longitudesAcumuladas(lista);
  return barreras.filter(
    (barrera) =>
      proyectarEnRuta(lista, acumuladas, barrera.punto).desvioM <= radioM,
  );
}

/** Barrera más próxima a la posición actual dentro del radio de alerta. */
export function barreraCercana(
  posicion: Coordenada,
  barreras: readonly BarreraUbicada[],
  radioM = RADIO_ALERTA_BARRERA_M,
): { barrera: BarreraUbicada; metros: number } | null {
  let mejor: { barrera: BarreraUbicada; metros: number } | null = null;
  for (const barrera of barreras) {
    const metros = distanciaKm(posicion, barrera.punto) * 1000;
    if (metros <= radioM && (!mejor || metros < mejor.metros)) {
      mejor = { barrera, metros };
    }
  }
  return mejor;
}

export function textoBarreraEnRuta(barrera: BarreraUbicada): string {
  return `La ruta pasa junto a una barrera crítica reportada en ${barrera.nombre}: ${barrera.descripcion}.`;
}

/** Texto estable por barrera (no cambia con cada lectura del GPS). */
export function textoBarreraCercana(barrera: BarreraUbicada): string {
  return `Te acercas a una barrera crítica (menos de ${RADIO_ALERTA_BARRERA_M} m) en ${barrera.nombre}: ${barrera.descripcion}. Puedes recalcular la ruta para evitarla.`;
}
