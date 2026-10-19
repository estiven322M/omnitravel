import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { coordenadaValida, estadoParaBd, ReportesService } from './reportes.service';

/**
 * Proceso 1 — validación colaborativa (RF-02, RNF-18, RNF-23, RNF-28).
 * Pruebas unitarias del servicio con una BD simulada: `query` responde en el
 * orden en que el servicio consulta, y la transacción reutiliza el mismo mock.
 */
function crearDb(respuestas: unknown[][]) {
  const query = jest.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const db = {
    query,
    transaction: jest.fn((trabajo: (m: { query: jest.Mock }) => unknown) => trabajo({ query })),
  };
  return { db: db as unknown as DataSource, query };
}

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

const codigo = (error: HttpException) => (error.getResponse() as { error: string }).error;

/** Respuestas de `publicar`: poi del reporte, bloqueo y 4 escrituras. */
const PUBLICAR = [[{ poi_id: '7' }], [], [], [], [], []];
const ES_MODERADOR = [{ '?column?': 1 }];
const LUGAR_NUEVO = { nombre: 'Museo del Oro Quimbaya', lat: 4.537, lon: -75.675 };

describe('ReportesService — Proceso 1: validación colaborativa', () => {
  describe('crear reporte (RF-02)', () => {
    it('CP-U01 rechaza un lugar nuevo sin nombre (400 DATOS_INCOMPLETOS)', async () => {
      const { db, query } = crearDb([]);
      const error = await capturar(
        new ReportesService(db).crear('5', { ...LUGAR_NUEVO, nombre: '   ' }),
      );
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('DATOS_INCOMPLETOS');
      expect(query).not.toHaveBeenCalled();
    });

    it('CP-U02 rechaza un lugar nuevo sin coordenadas numéricas', async () => {
      const { db } = crearDb([]);
      const error = await capturar(
        new ReportesService(db).crear('5', { ...LUGAR_NUEVO, lat: null }),
      );
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('DATOS_INCOMPLETOS');
    });

    it('CP-U03 rechaza coordenadas fuera de rango (400 COORDENADAS_INVALIDAS)', async () => {
      const { db, query } = crearDb([]);
      const error = await capturar(
        new ReportesService(db).crear('5', { ...LUGAR_NUEVO, lat: 95 }),
      );
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('COORDENADAS_INVALIDAS');
      expect(query).not.toHaveBeenCalled();
    });

    it('CP-U04 un lugar nuevo válido queda pendiente de validación', async () => {
      const { db, query } = crearDb([[{ id_poi: '7' }], [{ id_reporte: '11' }]]);
      const resultado = await new ReportesService(db).crear('5', LUGAR_NUEVO);

      expect(resultado).toEqual({ id_reporte: 11, id_poi: 7, estado: 'pendiente_validacion' });
      expect(query.mock.calls[0][0]).toContain("'pendiente'");
      expect(query.mock.calls[1][1]).toEqual([
        '7',
        '5',
        'nuevo',
        'pendiente_validacion',
        '',
        false,
      ]);
    });

    it('CP-U05 responde 404 si el lugar a actualizar no existe', async () => {
      const { db } = crearDb([[]]);
      const error = await capturar(new ReportesService(db).crear('5', { poiId: 999 }));
      expect(error.getStatus()).toBe(404);
      expect(codigo(error)).toBe('POI_NO_ENCONTRADO');
    });

    it('CP-U06 no acepta evidencia subida por otra cuenta (403)', async () => {
      const { db } = crearDb([[{ id_poi: '7' }], [{ id_reporte: '11' }]]);
      const error = await capturar(
        new ReportesService(db).crear('5', {
          ...LUGAR_NUEVO,
          evidenciaStorageKey: '8/foto.jpg',
        }),
      );
      expect(error.getStatus()).toBe(403);
    });
  });

  describe('confirmar reporte — consenso de 3 (RNF-18, RNF-23, RNF-28)', () => {
    const pendienteDe = (creador: string) => [{ usuario_creador_id: creador, estado: 'pendiente_validacion' }];

    it('CP-U07 impide la autoconfirmación (422 AUTOCONFIRMACION)', async () => {
      const { db } = crearDb([pendienteDe('5')]);
      const error = await capturar(new ReportesService(db).confirmar('5', '11'));
      expect(error.getStatus()).toBe(422);
      expect(codigo(error)).toBe('AUTOCONFIRMACION');
    });

    it('CP-U08 impide confirmar dos veces el mismo reporte (409)', async () => {
      const { db } = crearDb([pendienteDe('5'), [{ '?column?': 1 }]]);
      const error = await capturar(new ReportesService(db).confirmar('6', '11'));
      expect(error.getStatus()).toBe(409);
      expect(codigo(error)).toBe('CONFIRMACION_DUPLICADA');
    });

    it('CP-U09 responde 404 si el reporte no existe', async () => {
      const { db } = crearDb([[]]);
      const error = await capturar(new ReportesService(db).confirmar('6', '404'));
      expect(error.getStatus()).toBe(404);
    });

    it('CP-U10 no permite confirmar un reporte rechazado por moderación (409)', async () => {
      const { db } = crearDb([[{ usuario_creador_id: '5', estado: 'rechazado' }]]);
      const error = await capturar(new ReportesService(db).confirmar('6', '11'));
      expect(error.getStatus()).toBe(409);
      expect(codigo(error)).toBe('REPORTE_RECHAZADO');
    });

    it('CP-U11 con 2 confirmaciones el reporte sigue pendiente', async () => {
      const { db, query } = crearDb([pendienteDe('5'), [], [], [{ total: 2 }]]);
      const resultado = await new ReportesService(db).confirmar('6', '11');
      expect(resultado).toEqual({ confirmaciones: 2, publicado: false });
      expect(query).toHaveBeenCalledTimes(4);
    });

    it('CP-U12 la tercera confirmación publica el reporte automáticamente', async () => {
      const { db, query } = crearDb([pendienteDe('5'), [], [], [{ total: 3 }], ...PUBLICAR]);
      const resultado = await new ReportesService(db).confirmar('7', '11');

      expect(resultado).toEqual({ confirmaciones: 3, publicado: true });
      const actualizacion = query.mock.calls.find(([sql]) =>
        String(sql).includes("set estado = 'publicado', via_resolucion"),
      );
      expect(actualizacion?.[1]).toEqual(['11', 'automatica']);
    });
  });

  describe('moderación (RNF-09)', () => {
    it('CP-U13 solo un moderador puede decidir (403)', async () => {
      const { db } = crearDb([[]]);
      const error = await capturar(new ReportesService(db).decidir('5', '11', 'aprobado'));
      expect(error.getStatus()).toBe(403);
    });

    it('CP-U14 el rechazo exige un motivo (400 MOTIVO_REQUERIDO)', async () => {
      const { db } = crearDb([ES_MODERADOR]);
      const error = await capturar(new ReportesService(db).decidir('2', '11', 'rechazado', '  '));
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('MOTIVO_REQUERIDO');
    });

    it('CP-U15 rechaza una acción desconocida (400 ACCION_INVALIDA)', async () => {
      const { db } = crearDb([ES_MODERADOR]);
      const error = await capturar(new ReportesService(db).decidir('2', '11', 'borrar'));
      expect(codigo(error)).toBe('ACCION_INVALIDA');
    });

    it('CP-U16 aprobar publica el reporte (vía manual) y queda auditado', async () => {
      const { db, query } = crearDb([ES_MODERADOR, [{ '?column?': 1 }], ...PUBLICAR, []]);
      const resultado = await new ReportesService(db).decidir('2', '11', 'aprobado');

      expect(resultado).toEqual({ estado: 'publicado' });
      const auditoria = query.mock.calls[query.mock.calls.length - 1];
      expect(auditoria[0]).toContain('insert into moderacion');
      expect(auditoria[1]).toEqual(['11', '2', 'aprobar', '']);
    });
  });

  describe('utilidades', () => {
    it('CP-U17 valida rangos de latitud y longitud', () => {
      expect(coordenadaValida(4.537, -75.675)).toBe(true);
      expect(coordenadaValida(90, 180)).toBe(true);
      expect(coordenadaValida(90.1, 0)).toBe(false);
      expect(coordenadaValida(0, -180.5)).toBe(false);
    });

    it('CP-U18 traduce el estado heredado «pendiente» al de la BD', () => {
      expect(estadoParaBd('pendiente')).toBe('pendiente_validacion');
      expect(estadoParaBd('publicado')).toBe('publicado');
    });
  });
});
