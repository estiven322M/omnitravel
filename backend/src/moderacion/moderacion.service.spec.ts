import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { ModeracionService } from './moderacion.service';

/** DataSource falso: `query` responde en orden; la transacción reutiliza el mismo mock. */
function crearDb(respuestas: unknown[][]) {
  const query = jest.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const db = {
    query,
    transaction: jest.fn((trabajo: (m: { query: jest.Mock }) => unknown) => trabajo({ query })),
  };
  return { db: db as unknown as DataSource, query };
}

const ES_MODERADOR = [{ '?column?': 1 }];

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

describe('ModeracionService', () => {
  it('rechaza con 403 a quien no tiene rol de moderación', async () => {
    const { db } = crearDb([[]]);
    const error = await capturar(new ModeracionService(db).resumen('3'));
    expect(error.getStatus()).toBe(403);
  });

  it('resumen calcula la tasa de resolución con los datos de la BD', async () => {
    const { db } = crearDb([
      ES_MODERADOR,
      [{ pendientes: 2, discrepancias: 1, verificados_hoy: 1 }],
      [],
      [],
      [
        {
          recibidos: 8,
          resueltos: 6,
          procesados_mes: 4,
          procesados_mes_anterior: 2,
          horas_promedio: 6.4,
        },
      ],
    ]);
    const resumen = await new ModeracionService(db).resumen('10');
    expect(resumen).toMatchObject({
      pendientes: 2,
      discrepancias: 1,
      verificadosHoy: 1,
      desempeno: { tasaResolucion: 75, procesadosMes: 4, procesadosMesAnterior: 2, horasPromedio: 6.4 },
    });
  });

  it('sin reportes la tasa es 0 (no divide por cero)', async () => {
    const { db } = crearDb([
      ES_MODERADOR,
      [{ pendientes: 0, discrepancias: 0, verificados_hoy: 0 }],
      [],
      [],
      [{ recibidos: 0, resueltos: 0, procesados_mes: 0, procesados_mes_anterior: 0, horas_promedio: null }],
    ]);
    const resumen = await new ModeracionService(db).resumen('10');
    expect(resumen.desempeno.tasaResolucion).toBe(0);
  });

  it('desactivar punto: 404 si la incidencia no existe', async () => {
    const { db } = crearDb([ES_MODERADOR, []]);
    const error = await capturar(new ModeracionService(db).desactivarPunto('10', 99));
    expect(error.getStatus()).toBe(404);
  });

  it('desactivar punto: 409 si la incidencia ya está resuelta', async () => {
    const { db } = crearDb([ES_MODERADOR, [{ poi_id: 2, estado: 'resuelta' }]]);
    const error = await capturar(new ModeracionService(db).desactivarPunto('10', 1));
    expect(error.getStatus()).toBe(409);
  });

  it('desactivar punto: el POI vuelve a revisión, se cierra la incidencia y queda auditado', async () => {
    const { db, query } = crearDb([ES_MODERADOR, [{ poi_id: 2, estado: 'abierta' }], [], [], []]);
    const resultado = await new ModeracionService(db).desactivarPunto('10', 1);
    expect(resultado).toEqual({ incidencia: 1, poi: 2, estadoPoi: 'en_revision' });
    const sentencias = query.mock.calls.map(([sql]) => String(sql));
    expect(sentencias.some((sql) => sql.includes("set estado = 'en_revision'"))).toBe(true);
    expect(sentencias.some((sql) => sql.includes("set estado = 'resuelta'"))).toBe(true);
    expect(sentencias.some((sql) => sql.includes('registro_auditoria'))).toBe(true);
  });

  it('solicitar evidencia reutiliza la solicitud abierta (idempotente)', async () => {
    const { db, query } = crearDb([
      ES_MODERADOR,
      [{ poi_id: 2, estado: 'en_proceso' }],
      [{ id_solicitud: 7 }],
      [],
      [],
    ]);
    const resultado = await new ModeracionService(db).solicitarEvidencia('10', 1);
    expect(resultado).toEqual({ incidencia: 1, solicitud: 7, estado: 'en_proceso' });
    const inserciones = query.mock.calls.filter(([sql]) =>
      String(sql).includes('insert into solicitud_reverificacion'),
    );
    expect(inserciones).toHaveLength(0);
  });
});
