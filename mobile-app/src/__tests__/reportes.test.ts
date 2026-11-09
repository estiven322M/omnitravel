import {
  mapearErrorReporte,
  mapearReporteComunitario,
  mapearReporteModeracion,
} from '../services/reportes';

jest.mock('../services/api/client', () => ({ apiFetch: jest.fn() }));

describe('mapearErrorReporte', () => {
  it('extrae el código y el mensaje de la convención "CODIGO: mensaje"', () => {
    const error = mapearErrorReporte(
      'AUTOCONFIRMACION: No puedes confirmar tu propio reporte.',
    );
    expect(error.codigo).toBe('AUTOCONFIRMACION');
    expect(error.message).toBe('No puedes confirmar tu propio reporte.');
  });

  it('usa el mensaje por defecto cuando solo llega el código', () => {
    const error = mapearErrorReporte('CONFIRMACION_DUPLICADA');
    expect(error.codigo).toBe('CONFIRMACION_DUPLICADA');
    expect(error.message).toBe('Ya confirmaste este reporte antes.');
  });

  it('degrada mensajes desconocidos (p. ej. de red) a un texto amable', () => {
    const error = mapearErrorReporte('Network request failed');
    expect(error.codigo).toBe('DESCONOCIDO');
    expect(error.message).toBe(
      'No pudimos completar la operación. Inténtalo de nuevo.',
    );
  });

  it('tolera mensajes vacíos', () => {
    const error = mapearErrorReporte('');
    expect(error.codigo).toBe('DESCONOCIDO');
  });
});

describe('mapearReporteComunitario', () => {
  const fila = {
    id_reporte: 12,
    poi_id: 5,
    estado: 'PENDIENTE',
    es_critico: true,
    fecha_creacion: '2026-10-18T10:00:00.000Z',
  };

  it('normaliza la fila de la BD al contrato del front', () => {
    expect(mapearReporteComunitario(fila, 2)).toEqual({
      id: '12',
      poiId: '5',
      estado: 'pendiente',
      esCritico: true,
      confirmaciones: 2,
    });
  });

  it('trata es_critico nulo como false', () => {
    const reporte = mapearReporteComunitario({ ...fila, es_critico: null }, 0);
    expect(reporte.esCritico).toBe(false);
  });
});

describe('mapearReporteModeracion', () => {
  const fila = {
    id_reporte: 7,
    tipo: 'nuevo',
    estado: 'pendiente',
    descripcion: 'La rampa está rota',
    fecha_creacion: '2026-10-18T09:00:00.000Z',
    es_critico: true,
    autor: 'demo@omnitravel.test',
    confirmaciones: 1,
    poi: {
      id_poi: 21,
      nombre: 'Centro Cultural',
      tipo: 'atraccion',
      direccion: 'Calle 1 # 2-3',
      estado: 'pendiente',
      lat: 4.53389,
      lon: -75.68111,
    },
    valores: [
      {
        caracteristica_id: 2,
        nombre: 'Tiene rampa',
        valor_texto: null,
        valor_numerico: null,
        valor_booleano: true,
      },
    ],
    evidencia: [{ id_evidencia: 3, tipo: 'foto', storage_key: 'uid/foto.jpg' }],
  };

  it('traduce la fila anidada de la RPC al contrato del front', () => {
    const reporte = mapearReporteModeracion(fila);
    expect(reporte.id).toBe('7');
    expect(reporte.esCritico).toBe(true);
    expect(reporte.poi.nombre).toBe('Centro Cultural');
    expect(reporte.poi.lat).toBeCloseTo(4.53389);
    expect(reporte.valores).toEqual([
      {
        caracteristicaId: 2,
        nombre: 'Tiene rampa',
        valorBooleano: true,
        valorNumerico: undefined,
        valorTexto: undefined,
      },
    ]);
    expect(reporte.evidencia[0].storageKey).toBe('uid/foto.jpg');
  });

  it('incluye las denuncias pendientes de la comunidad (C4)', () => {
    const reporte = mapearReporteModeracion({
      ...fila,
      denuncias: [
        {
          motivo: 'informacion_falsa',
          descripcion: 'No hay rampa',
          fecha: '2026-11-09T15:00:00.000Z',
        },
      ],
    });
    expect(reporte.denuncias).toEqual([
      {
        motivo: 'informacion_falsa',
        descripcion: 'No hay rampa',
        fecha: '2026-11-09T15:00:00.000Z',
      },
    ]);
    expect(mapearReporteModeracion(fila).denuncias).toEqual([]);
    expect(
      mapearErrorReporte('DENUNCIA_DUPLICADA: Ya denunciaste este reporte.')
        .codigo,
    ).toBe('DENUNCIA_DUPLICADA');
  });

  it('tolera valores y evidencia nulos (reporte sin propuestas ni foto)', () => {
    const reporte = mapearReporteModeracion({
      ...fila,
      valores: null,
      evidencia: null,
      es_critico: null,
      autor: null,
      confirmaciones: null,
      poi: { ...fila.poi, lat: null, lon: null, direccion: null },
    });
    expect(reporte.valores).toEqual([]);
    expect(reporte.evidencia).toEqual([]);
    expect(reporte.esCritico).toBe(false);
    expect(reporte.confirmaciones).toBe(0);
    expect(reporte.poi.lat).toBeUndefined();
    expect(reporte.poi.direccion).toBe('');
  });
});
