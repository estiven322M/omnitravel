import { distanciaKm } from '../utils/geo';

/**
 * Plan de pruebas — Proceso 2 · Función de cálculo de distancias
 * (CP-017 a CP-019). La función vive en la app (`utils/geo.ts`); los demás
 * casos del Proceso 2 están en backend/src/routing/valhalla-payload.plan.spec.ts.
 */
describe('Proceso 2 · Función de cálculo de distancias', () => {
  it('CP-017 la distancia entre dos puntos distintos es mayor que 0', () => {
    const plazaBolivar = { latitude: 4.5339, longitude: -75.6811 };
    const museoDelOro = { latitude: 4.5534, longitude: -75.6586 };

    const km = distanciaKm(plazaBolivar, museoDelOro);
    expect(km).toBeGreaterThan(0);
    // ~3,3 km en línea recta: descarta un cálculo en grados o en metros.
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(4);
  });

  it('CP-018 la distancia de un punto a sí mismo es 0', () => {
    const punto = { latitude: 4.5534, longitude: -75.6586 };
    expect(distanciaKm(punto, punto)).toBe(0);
  });

  it('CP-019 coordenadas en el límite válido (lat 90, lng 180) no lanzan error', () => {
    const limite = { latitude: 90, longitude: 180 };
    const armenia = { latitude: 4.5339, longitude: -75.6811 };

    let km = Number.NaN;
    expect(() => {
      km = distanciaKm(limite, armenia);
    }).not.toThrow();
    expect(Number.isFinite(km)).toBe(true);
    expect(distanciaKm(limite, limite)).toBe(0);
  });
});
