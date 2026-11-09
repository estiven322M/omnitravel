import type { Coordenada } from '../services/types';
import { distanciaKm } from './geo';
import { longitudesAcumuladas, puntoEnRuta } from './progresoRuta';

/**
 * «Cambiar ruta» (Proceso 2, U06/U07): para que la ruta nueva sea realmente
 * distinta, se piden al motor (Valhalla `exclude_locations`) puntos
 * intermedios de la ruta actual que debe evitar.
 */

/** Rutas más cortas que esto no tienen tramos intermedios que evitar. */
export const LONGITUD_MINIMA_M = 150;
/** Máximo de puntos que acepta el backend por solicitud. */
export const MAX_PUNTOS_EVITAR = 8;

/** Puntos de la ruta en las fracciones indicadas de su longitud (sin extremos). */
export function puntosParaEvitar(
  coordenadas: Coordenada[],
  fracciones: number[] = [0.3, 0.5, 0.7],
): Coordenada[] {
  if (coordenadas.length < 2) {
    return [];
  }
  const acumuladas = longitudesAcumuladas(coordenadas);
  const total = acumuladas[acumuladas.length - 1];
  if (total < LONGITUD_MINIMA_M) {
    return [];
  }
  return fracciones
    .filter((f) => f > 0 && f < 1)
    .map((f) => puntoEnRuta(coordenadas, acumuladas, total * f));
}

/** Une los puntos ya evitados con los nuevos, sin pasar del máximo. */
export function combinarPuntos(
  previos: Coordenada[],
  nuevos: Coordenada[],
): Coordenada[] {
  return [...previos, ...nuevos].slice(-MAX_PUNTOS_EVITAR);
}

const metros = (a: Coordenada, b: Coordenada) => distanciaKm(a, b) * 1000;

/**
 * ¿Las dos rutas siguen caminos distintos? Se muestrean 20 puntos de la
 * nueva; si al menos el 20 % queda a más de `umbralM` metros de cualquier
 * vértice de la actual, se considera otro camino.
 */
export function rutasSonDistintas(
  actual: Coordenada[],
  nueva: Coordenada[],
  umbralM = 30,
): boolean {
  if (actual.length < 2 || nueva.length < 2) {
    return false;
  }
  const muestras = 20;
  let alejados = 0;
  for (let i = 0; i < muestras; i += 1) {
    const punto = nueva[Math.round((i / (muestras - 1)) * (nueva.length - 1))];
    const masCercano = Math.min(...actual.map((v) => metros(v, punto)));
    if (masCercano > umbralM) {
      alejados += 1;
    }
  }
  return alejados / muestras >= 0.2;
}
