import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { FeedbackService } from './feedback.service';

/**
 * Proceso 3 — visitas y retroalimentación post-viaje.
 * Pruebas unitarias con una BD simulada: `query` responde en el orden en que
 * el servicio consulta y la transacción reutiliza el mismo mock.
 */
function crearDb(respuestas: unknown[][]) {
  const query = jest.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const db = {
    query,
    transaction: jest.fn((trabajo: (m: { query: jest.Mock }) => unknown) =>
      trabajo({ query }),
    ),
  };
  return { db: db as unknown as DataSource, query };
}

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

const codigo = (error: HttpException) =>
  (error.getResponse() as { error: string }).error;

const POI = {
  id_poi: 1,
  nombre: 'Parque de la Vida',
  tipo: 'parque',
  direccion: 'Calle 1',
};

const VISITA_EN_CURSO = {
  id_visita: 10,
  poi_id: 1,
  estado: 'en_curso' as const,
  fecha_inicio: '2026-11-08T10:00:00.000Z',
  fecha_fin: null,
};

const VISITA_COMPLETADA = {
  ...VISITA_EN_CURSO,
  estado: 'completada' as const,
  fecha_fin: '2026-11-08T11:00:00.000Z',
  poi_nombre: POI.nombre,
  poi_tipo: POI.tipo,
  poi_direccion: POI.direccion,
  poi_estado: 'publicado',
};

describe('FeedbackService — Proceso 3: visitas y retroalimentación', () => {
  describe('iniciar visita', () => {
    it('rechaza un poi_id inválido sin consultar la BD', async () => {
      const { db, query } = crearDb([]);
      const error = await capturar(
        new FeedbackService(db).iniciarVisita('3', { poi_id: 'abc' }),
      );
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('VALIDATION_ERROR');
      expect(query).not.toHaveBeenCalled();
    });

    it('crea la visita cuando no hay otra en curso', async () => {
      const { db, query } = crearDb([
        [],
        [POI],
        [],
        [{ ...VISITA_EN_CURSO, estado: 'en_curso' }],
      ]);
      const resultado = await new FeedbackService(db).iniciarVisita('3', {
        poi_id: 1,
      });

      expect(resultado.reutilizada).toBe(false);
      expect(resultado.visita.id_visita).toBe(10);
      expect(resultado.poi.nombre).toBe(POI.nombre);
      expect(query.mock.calls[3][1]).toEqual(['3', 1]);
    });

    it('reutiliza la visita en curso del mismo lugar', async () => {
      const { db, query } = crearDb([[], [POI], [VISITA_EN_CURSO]]);
      const resultado = await new FeedbackService(db).iniciarVisita('3', {
        poi_id: 1,
      });

      expect(resultado.reutilizada).toBe(true);
      expect(query).toHaveBeenCalledTimes(3);
    });

    it('cancela la visita anterior al iniciar otra ruta', async () => {
      const { db, query } = crearDb([
        [],
        [{ ...POI, id_poi: 2, nombre: 'Museo' }],
        [VISITA_EN_CURSO],
        [],
        [{ ...VISITA_EN_CURSO, id_visita: 11, poi_id: 2 }],
      ]);
      const resultado = await new FeedbackService(db).iniciarVisita('3', {
        poi_id: 2,
      });

      expect(resultado.visita.id_visita).toBe(11);
      expect(query.mock.calls[3][0]).toContain("estado = 'cancelada'");
      expect(query.mock.calls[3][1]).toEqual([10]);
    });

    it('responde 404 si el lugar no existe', async () => {
      const { db } = crearDb([[], []]);
      const error = await capturar(
        new FeedbackService(db).iniciarVisita('3', { poi_id: 999 }),
      );
      expect(error.getStatus()).toBe(404);
      expect(codigo(error)).toBe('POI_NO_ENCONTRADO');
    });
  });

  describe('finalizar visita', () => {
    it('rechaza un id inválido sin consultar la BD', async () => {
      const { db, query } = crearDb([]);
      const error = await capturar(
        new FeedbackService(db).finalizarVisita('3', 'x'),
      );
      expect(error.getStatus()).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });

    it('responde 404 si la visita no pertenece al usuario', async () => {
      const { db } = crearDb([[]]);
      const error = await capturar(
        new FeedbackService(db).finalizarVisita('3', 99),
      );
      expect(error.getStatus()).toBe(404);
      expect(codigo(error)).toBe('VISITA_NO_ENCONTRADA');
    });

    it('rechaza finalizar una visita cancelada', async () => {
      const { db } = crearDb([
        [{ ...VISITA_EN_CURSO, estado: 'cancelada' }],
      ]);
      const error = await capturar(
        new FeedbackService(db).finalizarVisita('3', 10),
      );
      expect(error.getStatus()).toBe(409);
      expect(codigo(error)).toBe('VISITA_CANCELADA');
    });

    it('marca la visita como completada', async () => {
      const { db, query } = crearDb([
        [{ ...VISITA_COMPLETADA, estado: 'en_curso', fecha_fin: null }],
        [[VISITA_COMPLETADA], 1],
      ]);
      const resultado = await new FeedbackService(db).finalizarVisita('3', 10);

      expect(resultado.yaFinalizada).toBe(false);
      expect(resultado.visita.estado).toBe('completada');
      expect(resultado.poi.nombre).toBe(POI.nombre);
      expect(query.mock.calls[1][1]).toEqual([10]);
    });

    it('es idempotente si la visita ya estaba completada', async () => {
      const { db, query } = crearDb([[VISITA_COMPLETADA]]);
      const resultado = await new FeedbackService(db).finalizarVisita('3', 10);

      expect(resultado.yaFinalizada).toBe(true);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('calificar una visita', () => {
    it('rechaza calificaciones fuera de 1–5 sin consultar la BD', async () => {
      const { db, query } = crearDb([]);
      const error = await capturar(
        new FeedbackService(db).crearExperiencia('3', {
          visita_id: 10,
          calificacion: 6,
        }),
      );
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('CALIFICACION_INVALIDA');
      expect(query).not.toHaveBeenCalled();
    });

    it('rechaza calificar una visita que no está completada', async () => {
      const { db } = crearDb([[VISITA_EN_CURSO]]);
      const error = await capturar(
        new FeedbackService(db).crearExperiencia('3', {
          visita_id: 10,
          calificacion: 5,
        }),
      );
      expect(error.getStatus()).toBe(409);
      expect(codigo(error)).toBe('VISITA_NO_COMPLETADA');
    });

    it('impide calificar dos veces la misma visita', async () => {
      const { db } = crearDb([[VISITA_COMPLETADA], [{ id_retroalimentacion: 5 }]]);
      const error = await capturar(
        new FeedbackService(db).crearExperiencia('3', {
          visita_id: 10,
          calificacion: 5,
        }),
      );
      expect(error.getStatus()).toBe(409);
      expect(codigo(error)).toBe('VISITA_YA_CALIFICADA');
    });

    it('guarda una experiencia positiva sin abrir incidencia', async () => {
      const { db, query } = crearDb([
        [VISITA_COMPLETADA],
        [],
        [
          {
            id_retroalimentacion: 5,
            calificacion: 5,
            comentario: 'Excelente',
            fecha: '2026-11-08T11:05:00.000Z',
          },
        ],
      ]);
      const resultado = await new FeedbackService(db).crearExperiencia('3', {
        visita_id: 10,
        calificacion: 5,
        comentario: 'Excelente',
      });

      expect(resultado.incidencia).toBeNull();
      expect(resultado.reporte).toBeNull();
      expect(resultado.experiencia.calificacion).toBe(5);
      expect(query).toHaveBeenCalledTimes(3);
    });

    it('una calificación ≤ 2 abre incidencia, reporte y re-verificación', async () => {
      const { db, query } = crearDb([
        [VISITA_COMPLETADA],
        [],
        [
          {
            id_retroalimentacion: 5,
            calificacion: 2,
            comentario: 'Falta la rampa',
            fecha: '2026-11-08T11:05:00.000Z',
          },
        ],
        [
          {
            id_incidencia: 7,
            tipo: 'calificacion_baja',
            estado: 'abierta',
            fecha_creacion: '2026-11-08T11:05:00.000Z',
          },
        ],
        [{ id_reporte: 30, estado: 'pendiente_validacion' }],
        [{ id_solicitud: 4, estado: 'pendiente' }],
        [],
        [],
      ]);
      const resultado = await new FeedbackService(db).crearExperiencia('3', {
        visita_id: 10,
        calificacion: 2,
        comentario: 'Falta la rampa',
      });

      expect(resultado.incidencia.id_incidencia).toBe(7);
      expect(resultado.reporte.id_reporte).toBe(30);
      expect(resultado.solicitud.id_solicitud).toBe(4);
      expect(resultado.poi.estado).toBe('en_revision');
      expect(query.mock.calls[3][1][1]).toBe('calificacion_baja');
      expect(query.mock.calls[4][1][3]).toBe(true);
      expect(query.mock.calls[6][0]).toContain("estado = 'en_revision'");
    });

    it('una discrepancia explícita con calificación alta también re-verifica', async () => {
      const { db, query } = crearDb([
        [VISITA_COMPLETADA],
        [],
        [
          {
            id_retroalimentacion: 6,
            calificacion: 5,
            comentario: 'La puerta está cerrada',
            fecha: '2026-11-08T11:05:00.000Z',
          },
        ],
        [
          {
            id_incidencia: 8,
            tipo: 'barrera',
            estado: 'abierta',
            fecha_creacion: '2026-11-08T11:05:00.000Z',
          },
        ],
        [{ id_reporte: 31, estado: 'pendiente_validacion' }],
        [{ id_solicitud: 5, estado: 'pendiente' }],
        [],
        [],
      ]);
      const resultado = await new FeedbackService(db).crearExperiencia('3', {
        visita_id: 10,
        calificacion: 5,
        discrepancia: true,
        tipo_incidencia: 'barrera',
        descripcion_incidencia: 'La puerta está cerrada',
      });

      expect(resultado.incidencia.tipo).toBe('barrera');
      expect(resultado.poi.estado).toBe('en_revision');
      expect(query.mock.calls[3][1][1]).toBe('barrera');
      expect(query.mock.calls[4][1][3]).toBe(false);
    });
  });

  describe('consultas', () => {
    it('lista las visitas completadas pendientes de calificar', async () => {
      const pendiente = {
        id_visita: 10,
        poi_id: 1,
        fecha_inicio: VISITA_EN_CURSO.fecha_inicio,
        fecha_fin: VISITA_COMPLETADA.fecha_fin,
        poi_nombre: POI.nombre,
        poi_tipo: POI.tipo,
        poi_direccion: POI.direccion,
      };
      const { db, query } = crearDb([[pendiente]]);
      const resultado = await new FeedbackService(db).visitasPendientes('3');

      expect(resultado).toEqual([pendiente]);
      expect(query.mock.calls[0][1]).toEqual(['3']);
    });

    it('devuelve experiencias públicas sin datos personales', async () => {
      const { db } = crearDb([
        [{ id_poi: 1, nombre: POI.nombre }],
        [
          {
            id_retroalimentacion: 5,
            calificacion: 4,
            comentario: 'Muy accesible',
            fecha: '2026-11-08T11:05:00.000Z',
            fecha_visita: '2026-11-08T11:00:00.000Z',
          },
        ],
        [{ total: 1, promedio: 4 }],
      ]);
      const resultado = await new FeedbackService(db).experienciasDePoi(1);

      expect(resultado.total).toBe(1);
      expect(resultado.promedio).toBe(4);
      expect(resultado.experiencias[0].autor).toBe('Viajero de la comunidad');
      expect(JSON.stringify(resultado)).not.toContain('@');
    });

    it('responde 404 si el lugar de las experiencias no existe', async () => {
      const { db } = crearDb([[]]);
      const error = await capturar(
        new FeedbackService(db).experienciasDePoi(999),
      );
      expect(error.getStatus()).toBe(404);
      expect(codigo(error)).toBe('POI_NO_ENCONTRADO');
    });

    it('lista las incidencias propias del viajero', async () => {
      const incidencia = {
        id_incidencia: 7,
        tipo: 'barrera',
        descripcion: 'Falta la rampa',
        estado: 'abierta',
        fecha_creacion: '2026-11-08T11:05:00.000Z',
        poi_id: 1,
        poi_nombre: POI.nombre,
        poi_direccion: POI.direccion,
        calificacion: 2,
        comentario: 'Falta la rampa',
      };
      const { db } = crearDb([[incidencia]]);
      const resultado = await new FeedbackService(db).incidenciasDeUsuario('3');
      expect(resultado).toEqual([incidencia]);
    });
  });
});
