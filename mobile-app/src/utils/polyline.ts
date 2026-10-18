import type { Coordenada } from '../services/types';

/**
 * Decodifica una polilínea codificada (formato Valhalla / Google).
 * Valhalla devuelve la geometría con precisión 6; Google con precisión 5.
 * Referencia: https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
 */
export function decodificarPolyline(
  codificada: string,
  precision = 6,
): Coordenada[] {
  const factor = Math.pow(10, precision);
  const coordenadas: Coordenada[] = [];

  let indice = 0;
  let latitud = 0;
  let longitud = 0;

  while (indice < codificada.length) {
    // Delta de latitud
    let resultado = 0;
    let desplazamiento = 0;
    let byte: number;
    do {
      byte = codificada.charCodeAt(indice) - 63;
      indice += 1;
      resultado |= (byte & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (byte >= 0x20);
    latitud += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    // Delta de longitud
    resultado = 0;
    desplazamiento = 0;
    do {
      byte = codificada.charCodeAt(indice) - 63;
      indice += 1;
      resultado |= (byte & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (byte >= 0x20);
    longitud += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    coordenadas.push({
      latitude: latitud / factor,
      longitude: longitud / factor,
    });
  }

  return coordenadas;
}
