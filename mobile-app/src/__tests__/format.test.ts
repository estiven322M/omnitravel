import { getCaracteristica } from '../services/mocks/catalog';
import {
  formatearDistancia,
  formatearFechaCorta,
  formatearValorCaracteristica,
} from '../utils/format';

describe('formatearValorCaracteristica', () => {
  const rampa = getCaracteristica('tiene_rampa')!;
  const ancho = getCaracteristica('ancho_puerta')!;

  it('formatea valores booleanos como Sí/No', () => {
    expect(
      formatearValorCaracteristica(rampa, {
        caracteristicaId: 'tiene_rampa',
        valorBooleano: true,
      }),
    ).toBe('Sí');
    expect(
      formatearValorCaracteristica(rampa, {
        caracteristicaId: 'tiene_rampa',
        valorBooleano: false,
      }),
    ).toBe('No');
  });

  it('formatea valores numéricos con su unidad', () => {
    expect(
      formatearValorCaracteristica(ancho, {
        caracteristicaId: 'ancho_puerta',
        valorNumerico: 90,
      }),
    ).toBe('90 cm');
  });

  it('devuelve "Sin información" cuando no hay valor', () => {
    expect(formatearValorCaracteristica(rampa, undefined)).toBe(
      'Sin información',
    );
    expect(
      formatearValorCaracteristica(rampa, { caracteristicaId: 'tiene_rampa' }),
    ).toBe('Sin información');
  });
});

describe('formatearFechaCorta', () => {
  it('formatea fechas ISO en español sin depender de Intl', () => {
    expect(formatearFechaCorta('2026-08-12T10:00:00.000Z')).toBe(
      '12 de agosto de 2026',
    );
  });

  it('maneja fechas inválidas', () => {
    expect(formatearFechaCorta('no-es-fecha')).toBe('Fecha desconocida');
  });
});

describe('formatearDistancia', () => {
  it('usa metros para distancias menores a 1 km', () => {
    expect(formatearDistancia(0.85)).toBe('850 m');
  });

  it('usa kilómetros con un decimal', () => {
    expect(formatearDistancia(1.234)).toBe('1.2 km');
  });
});
