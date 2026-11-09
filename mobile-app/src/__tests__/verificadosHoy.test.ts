import { mensajeDeUbicacion } from '../services/ubicacion';
import { esDeHoyEnColombia } from '../utils/verificadosHoy';

jest.mock('expo-location', () => ({}));

describe('esDeHoyEnColombia (Puntos verificados hoy)', () => {
  // 9 nov 2026, 1:00 a. m. en Colombia = 06:00 UTC.
  const ahora = new Date('2026-11-09T06:00:00Z');

  it('usa el día de Colombia, no el de UTC', () => {
    expect(esDeHoyEnColombia('2026-11-09T05:30:00Z', ahora)).toBe(true);
    expect(esDeHoyEnColombia('2026-11-09T04:30:00Z', ahora)).toBe(false);
  });

  it('descarta fechas vacías o inválidas', () => {
    expect(esDeHoyEnColombia(null, ahora)).toBe(false);
    expect(esDeHoyEnColombia('no-es-fecha', ahora)).toBe(false);
  });
});

describe('mensajeDeUbicacion', () => {
  it('explica cómo permitir la ubicación según la plataforma', () => {
    expect(mensajeDeUbicacion('permiso', 'web')).toContain('candado');
    expect(mensajeDeUbicacion('permiso', 'android')).toContain('Ajustes');
    expect(mensajeDeUbicacion('no-disponible', 'android')).toContain('GPS');
  });
});
