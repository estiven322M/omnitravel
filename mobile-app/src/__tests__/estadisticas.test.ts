import {
  etiquetaDia,
  formatoTiempoRespuesta,
  maximoRedondo,
  segmentosDe,
  variacion,
} from '../utils/estadisticas';

describe('estadísticas del moderador (M07)', () => {
  it('arma los segmentos en orden y omite los vacíos', () => {
    expect(
      segmentosDe({ publicado: 3, rechazado: 1, en_revision: 0 }, [
        'pendiente_validacion',
        'en_revision',
        'publicado',
        'rechazado',
      ]),
    ).toEqual([
      { clave: 'publicado', total: 3, porcentaje: 75 },
      { clave: 'rechazado', total: 1, porcentaje: 25 },
    ]);
    expect(segmentosDe({}, ['publicado'])).toEqual([]);
  });

  it('redondea el máximo del eje', () => {
    expect(maximoRedondo([0, 0])).toBe(1);
    expect(maximoRedondo([3, 7])).toBe(10);
    expect(maximoRedondo([12])).toBe(20);
    expect(maximoRedondo([46])).toBe(50);
  });

  it('nombra el día sin depender de la zona horaria', () => {
    expect(etiquetaDia('2026-11-08')).toBe('dom 8');
  });

  it('calcula la variación frente al mes anterior', () => {
    expect(variacion(12, 10)).toBe(20);
    expect(variacion(5, 0)).toBeNull();
  });
});

describe('formatoTiempoRespuesta', () => {
  it('muestra minutos, horas o días según la magnitud', () => {
    expect(formatoTiempoRespuesta(null)).toBe('—');
    expect(formatoTiempoRespuesta(0.25)).toBe('15 min');
    expect(formatoTiempoRespuesta(5.04)).toBe('5 h');
    expect(formatoTiempoRespuesta(12.36)).toBe('12,4 h');
    expect(formatoTiempoRespuesta(679.1)).toBe('28,3 días');
  });
});
