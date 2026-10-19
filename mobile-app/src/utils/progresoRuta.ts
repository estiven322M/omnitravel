import type { Coordenada, PasoRuta } from '../services/types';
import { distanciaKm } from './geo';

/**
 * Progreso sobre la ruta en curso (U07): cuánto se ha recorrido, qué tramo
 * falta dibujar y qué indicación toca, a partir de la posición GPS o del
 * paso que la persona elige.
 */

const metros = (a: Coordenada, b: Coordenada) => distanciaKm(a, b) * 1000;

/** Metros acumulados desde el inicio hasta cada vértice de la ruta. */
export function longitudesAcumuladas(coordenadas: Coordenada[]): number[] {
  const acumuladas = [0];
  for (let i = 1; i < coordenadas.length; i += 1) {
    acumuladas.push(
      acumuladas[i - 1] + metros(coordenadas[i - 1], coordenadas[i]),
    );
  }
  return acumuladas;
}

/** Punto de la ruta que está a `distanciaM` del inicio. */
export function puntoEnRuta(
  coordenadas: Coordenada[],
  acumuladas: number[],
  distanciaM: number,
): Coordenada {
  if (coordenadas.length === 0) {
    throw new Error('Ruta sin coordenadas');
  }
  const total = acumuladas[acumuladas.length - 1];
  const d = Math.min(Math.max(distanciaM, 0), total);
  for (let i = 1; i < coordenadas.length; i += 1) {
    if (acumuladas[i] >= d) {
      const tramo = acumuladas[i] - acumuladas[i - 1];
      const t = tramo > 0 ? (d - acumuladas[i - 1]) / tramo : 0;
      const a = coordenadas[i - 1];
      const b = coordenadas[i];
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      };
    }
  }
  return coordenadas[coordenadas.length - 1];
}

/** Tramo que falta: desde el punto a `distanciaM` hasta el destino. */
export function rutaRestante(
  coordenadas: Coordenada[],
  acumuladas: number[],
  distanciaM: number,
): Coordenada[] {
  if (coordenadas.length < 2) {
    return coordenadas;
  }
  const inicio = puntoEnRuta(coordenadas, acumuladas, distanciaM);
  const siguientes = coordenadas.filter(
    (_, indice) => acumuladas[indice] > distanciaM,
  );
  return [inicio, ...siguientes];
}

/**
 * Proyecta una posición sobre la ruta: a cuántos metros del inicio queda el
 * punto más cercano de la ruta y a cuántos metros está la persona de ella.
 */
export function proyectarEnRuta(
  coordenadas: Coordenada[],
  acumuladas: number[],
  posicion: Coordenada,
): { recorridoM: number; desvioM: number } {
  // Plano local (metros) centrado en la posición: suficiente a escala urbana.
  const cosLat = Math.cos((posicion.latitude * Math.PI) / 180);
  const aPlano = (c: Coordenada) => ({
    x: (c.longitude - posicion.longitude) * 111320 * cosLat,
    y: (c.latitude - posicion.latitude) * 110540,
  });

  let mejor = { recorridoM: 0, desvioM: Number.POSITIVE_INFINITY };
  for (let i = 1; i < coordenadas.length; i += 1) {
    const a = aPlano(coordenadas[i - 1]);
    const b = aPlano(coordenadas[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo2 = dx * dx + dy * dy;
    const t =
      largo2 > 0
        ? Math.min(Math.max(-(a.x * dx + a.y * dy) / largo2, 0), 1)
        : 0;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const desvio = Math.hypot(px, py);
    if (desvio < mejor.desvioM) {
      mejor = {
        desvioM: desvio,
        recorridoM: acumuladas[i - 1] + (acumuladas[i] - acumuladas[i - 1]) * t,
      };
    }
  }
  return mejor;
}

/**
 * Límites de cada paso en metros sobre la ruta. Las distancias del motor se
 * escalan a la longitud dibujada para que paso y mapa coincidan.
 */
export function limitesDePasos(
  pasos: Pick<PasoRuta, 'distanciaKm'>[],
  longitudTotalM: number,
): { inicioM: number; finM: number }[] {
  const sumaKm = pasos.reduce(
    (total, paso) => total + Math.max(paso.distanciaKm, 0),
    0,
  );
  const escala = sumaKm > 0 ? longitudTotalM / (sumaKm * 1000) : 0;
  let inicio = 0;
  return pasos.map((paso) => {
    const fin = inicio + Math.max(paso.distanciaKm, 0) * 1000 * escala;
    const limite = { inicioM: inicio, finM: fin };
    inicio = fin;
    return limite;
  });
}

/** Índice del paso vigente para la distancia recorrida. */
export function indicePasoEn(
  limites: { inicioM: number; finM: number }[],
  recorridoM: number,
): number {
  if (limites.length === 0) {
    return 0;
  }
  const indice = limites.findIndex((limite) => recorridoM < limite.finM);
  return indice === -1 ? limites.length - 1 : indice;
}
