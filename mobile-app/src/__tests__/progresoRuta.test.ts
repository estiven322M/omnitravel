import {
  indicePasoEn,
  limitesDePasos,
  longitudesAcumuladas,
  proyectarEnRuta,
  rutaRestante,
} from '../utils/progresoRuta';

// Ruta en L: ~111 m al norte y ~111 m al este.
const ruta = [
  { latitude: 4.53, longitude: -75.68 },
  { latitude: 4.531, longitude: -75.68 },
  { latitude: 4.531, longitude: -75.679 },
];
const acumuladas = longitudesAcumuladas(ruta);
const total = acumuladas[2];

describe('progreso sobre la ruta', () => {
  it('mide la longitud de la ruta', () => {
    expect(total).toBeGreaterThan(215);
    expect(total).toBeLessThan(230);
  });

  it('el tramo restante se acorta al avanzar', () => {
    const restante = rutaRestante(ruta, acumuladas, 150);
    expect(restante).toHaveLength(2);
    expect(longitudesAcumuladas(restante)[1]).toBeCloseTo(total - 150, 0);
  });

  it('proyecta la posición GPS sobre la ruta', () => {
    const { recorridoM, desvioM } = proyectarEnRuta(ruta, acumuladas, {
      latitude: 4.5305,
      longitude: -75.68005,
    });
    expect(recorridoM).toBeGreaterThan(50);
    expect(recorridoM).toBeLessThan(60);
    expect(desvioM).toBeLessThan(10);
  });

  it('elige el paso según lo recorrido', () => {
    const limites = limitesDePasos(
      [{ distanciaKm: 0.1 }, { distanciaKm: 0.1 }, { distanciaKm: 0 }],
      200,
    );
    expect(indicePasoEn(limites, 0)).toBe(0);
    expect(indicePasoEn(limites, 120)).toBe(1);
    expect(indicePasoEn(limites, 200)).toBe(2);
  });
});
