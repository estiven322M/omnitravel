import {
  combinarPuntos,
  MAX_PUNTOS_EVITAR,
  puntosParaEvitar,
  rutasSonDistintas,
} from '../utils/cambioRuta';

/** «Cambiar ruta» (Proceso 2): puntos a evitar y comparación de caminos. */
const recta = (lonInicio: number, lonFin: number, lat = 4.535, n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    latitude: lat,
    longitude: lonInicio + ((lonFin - lonInicio) * i) / (n - 1),
  }));

describe('puntosParaEvitar', () => {
  it('toma puntos intermedios de la ruta (no el origen ni el destino)', () => {
    const ruta = recta(-75.68, -75.67); // ~1,1 km
    const puntos = puntosParaEvitar(ruta);
    expect(puntos).toHaveLength(3);
    expect(puntos[1].longitude).toBeCloseTo(-75.675, 3);
  });

  it('una ruta de menos de 150 m no tiene puntos que evitar', () => {
    expect(puntosParaEvitar(recta(-75.68, -75.6795))).toEqual([]);
  });
});

describe('combinarPuntos', () => {
  it('conserva solo los últimos 8 puntos', () => {
    const muchos = recta(-75.68, -75.67, 4.535, 12);
    expect(combinarPuntos(muchos, muchos.slice(0, 2))).toHaveLength(
      MAX_PUNTOS_EVITAR,
    );
  });
});

describe('rutasSonDistintas', () => {
  it('la misma ruta no cuenta como distinta', () => {
    const ruta = recta(-75.68, -75.67);
    expect(rutasSonDistintas(ruta, ruta)).toBe(false);
  });

  it('una ruta por una calle paralela a ~110 m sí es distinta', () => {
    expect(
      rutasSonDistintas(recta(-75.68, -75.67), recta(-75.68, -75.67, 4.536)),
    ).toBe(true);
  });
});
