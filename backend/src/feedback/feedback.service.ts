import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { errorDominio } from '../common/errores';

/**
 * Proceso 3 — retroalimentación e incidencias post-viaje.
 *
 * Reglas de negocio:
 * - Una visita se inicia al entrar a la navegación paso a paso y se finaliza
 *   al pulsar «Finalizar ruta».
 * - Solo una visita COMPLETADA puede calificarse, y una sola vez.
 * - Una calificación ≤ 2 o una discrepancia explícita abre una incidencia,
 *   crea un reporte de re-verificación y deja el POI en revisión.
 * - El correo del viajero nunca se expone en las experiencias públicas.
 */

const MAX_COMENTARIO = 1000;
const MAX_DESCRIPCION = 1000;
const TIPOS_INCIDENCIA = new Set([
  'barrera',
  'informacion_incorrecta',
  'cerrado',
  'otro',
  'discrepancia',
]);

export interface DatosVisita {
  poi_id?: unknown;
}

export interface DatosExperiencia {
  visita_id?: unknown;
  calificacion?: unknown;
  comentario?: unknown;
  discrepancia?: unknown;
  tipo_incidencia?: unknown;
  descripcion_incidencia?: unknown;
}

function enteroPositivo(valor: unknown, campo: string): number {
  const numero =
    typeof valor === 'number'
      ? valor
      : typeof valor === 'string' && /^\d+$/.test(valor.trim())
        ? Number(valor)
        : Number.NaN;
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      `El campo ${campo} debe ser un entero positivo.`,
    );
  }
  return numero;
}

function calificacionValida(valor: unknown): number {
  const numero =
    typeof valor === 'number'
      ? valor
      : typeof valor === 'string' && /^\d+$/.test(valor.trim())
        ? Number(valor)
        : Number.NaN;
  if (!Number.isInteger(numero) || numero < 1 || numero > 5) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'CALIFICACION_INVALIDA',
      'La calificación debe ser un entero entre 1 y 5.',
    );
  }
  return numero;
}

function textoOpcional(
  valor: unknown,
  campo: string,
  maximo: number,
): string | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (typeof valor !== 'string') {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      `El campo ${campo} debe ser texto.`,
    );
  }
  const texto = valor.trim();
  if (texto.length > maximo) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      `El campo ${campo} no puede superar ${maximo} caracteres.`,
    );
  }
  return texto.length > 0 ? texto : null;
}

function booleanoOpcional(valor: unknown, campo: string): boolean {
  if (valor === undefined || valor === null) {
    return false;
  }
  if (typeof valor !== 'boolean') {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      `El campo ${campo} debe ser verdadero o falso.`,
    );
  }
  return valor;
}

function tipoIncidenciaOpcional(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  if (typeof valor !== 'string' || !TIPOS_INCIDENCIA.has(valor)) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'El tipo de incidencia no es válido.',
    );
  }
  return valor;
}

export interface FilaVisita {
  id_visita: number;
  poi_id: number;
  estado: 'en_curso' | 'completada' | 'cancelada';
  fecha_inicio: string;
  fecha_fin: string | null;
  poi_nombre?: string;
  poi_tipo?: string;
  poi_direccion?: string | null;
  poi_estado?: string;
}

export interface FilaPoi {
  id_poi: number;
  nombre: string;
  tipo: string;
  direccion: string | null;
}

@Injectable()
export class FeedbackService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** POST /visitas — inicia (o reutiliza) la visita en curso a un POI. */
  async iniciarVisita(usuarioId: string, datos: DatosVisita) {
    const poiId = enteroPositivo(datos?.poi_id, 'poi_id');

    return this.db.transaction(async (m) => {
      // Serializa los inicios de visita del mismo usuario: el índice único
      // parcial visita_en_curso_por_usuario no admite dos visitas abiertas.
      await m.query(`select pg_advisory_xact_lock(hashtext($1))`, [
        `visita:${usuarioId}`,
      ]);

      const [poi]: FilaPoi[] = await m.query(
        `select id_poi::int, nombre, tipo, direccion
           from poi
          where id_poi = $1 and estado <> 'rechazado'`,
        [poiId],
      );
      if (!poi) {
        throw errorDominio(
          HttpStatus.NOT_FOUND,
          'POI_NO_ENCONTRADO',
          'El lugar no existe o no está disponible.',
        );
      }

      const [activa]: FilaVisita[] = await m.query(
        `select id_visita::int, poi_id::int, estado, fecha_inicio, fecha_fin
           from visita
          where usuario_id = $1 and estado = 'en_curso'
          for update`,
        [usuarioId],
      );

      if (activa && activa.poi_id === poiId) {
        return { visita: activa, poi, reutilizada: true };
      }

      if (activa) {
        await m.query(
          `update visita
              set estado = 'cancelada', fecha_fin = now()
            where id_visita = $1`,
          [activa.id_visita],
        );
      }

      const [visita]: FilaVisita[] = await m.query(
        `insert into visita (usuario_id, poi_id)
         values ($1, $2)
         returning id_visita::int, poi_id::int, estado, fecha_inicio, fecha_fin`,
        [usuarioId, poiId],
      );
      return { visita, poi, reutilizada: false };
    });
  }

  /** POST /visitas/:id/finalizar — cierra la visita y habilita su calificación. */
  async finalizarVisita(usuarioId: string, visitaIdRaw: unknown) {
    const visitaId = enteroPositivo(visitaIdRaw, 'id');

    return this.db.transaction(async (m) => {
      const [visita]: FilaVisita[] = await m.query(
        `select v.id_visita::int, v.poi_id::int, v.estado, v.fecha_inicio,
                v.fecha_fin, p.nombre as poi_nombre, p.tipo as poi_tipo,
                p.direccion as poi_direccion
           from visita v
           join poi p on p.id_poi = v.poi_id
          where v.id_visita = $1 and v.usuario_id = $2
          for update of v`,
        [visitaId, usuarioId],
      );
      if (!visita) {
        throw errorDominio(
          HttpStatus.NOT_FOUND,
          'VISITA_NO_ENCONTRADA',
          'La visita no existe o no pertenece a tu cuenta.',
        );
      }
      if (visita.estado === 'cancelada') {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'VISITA_CANCELADA',
          'La visita fue cancelada al iniciar otra ruta.',
        );
      }

      const poi = {
        id_poi: visita.poi_id,
        nombre: visita.poi_nombre ?? '',
        tipo: visita.poi_tipo ?? '',
        direccion: visita.poi_direccion ?? null,
      };

      if (visita.estado === 'completada') {
        return { visita, poi, yaFinalizada: true };
      }

      // TypeORM devuelve [filas, afectadas] en UPDATE … RETURNING.
      const [filasActualizadas]: [FilaVisita[], number] = await m.query(
        `update visita
            set estado = 'completada', fecha_fin = now()
          where id_visita = $1
          returning id_visita::int, poi_id::int, estado, fecha_inicio, fecha_fin`,
        [visitaId],
      );
      const actualizada = filasActualizadas[0];
      return { visita: actualizada, poi, yaFinalizada: false };
    });
  }

  /** GET /visitas/pendientes — visitas completadas aún sin calificar. */
  async visitasPendientes(usuarioId: string) {
    return this.db.query(
      `select v.id_visita::int, v.poi_id::int, v.fecha_inicio, v.fecha_fin,
              p.nombre as poi_nombre, p.tipo as poi_tipo,
              p.direccion as poi_direccion
         from visita v
         join poi p on p.id_poi = v.poi_id
         left join retroalimentacion r on r.visita_id = v.id_visita
        where v.usuario_id = $1
          and v.estado = 'completada'
          and r.id_retroalimentacion is null
        order by v.fecha_fin desc
        limit 20`,
      [usuarioId],
    );
  }

  /**
   * POST /experiences — califica una visita completada y, si hay una
   * discrepancia o una calificación baja, dispara la re-verificación.
   */
  async crearExperiencia(usuarioId: string, datos: DatosExperiencia) {
    const visitaId = enteroPositivo(datos?.visita_id, 'visita_id');
    const calificacion = calificacionValida(datos?.calificacion);
    const comentario = textoOpcional(
      datos?.comentario,
      'comentario',
      MAX_COMENTARIO,
    );
    const discrepancia = booleanoOpcional(datos?.discrepancia, 'discrepancia');
    const tipoSolicitado = tipoIncidenciaOpcional(datos?.tipo_incidencia);
    const descripcion = textoOpcional(
      datos?.descripcion_incidencia,
      'descripcion_incidencia',
      MAX_DESCRIPCION,
    );

    return this.db.transaction(async (m) => {
      const [visita]: FilaVisita[] = await m.query(
        `select v.id_visita::int, v.poi_id::int, v.estado, v.fecha_inicio,
                v.fecha_fin, p.nombre as poi_nombre, p.estado as poi_estado
           from visita v
           join poi p on p.id_poi = v.poi_id
          where v.id_visita = $1 and v.usuario_id = $2
          for update of v`,
        [visitaId, usuarioId],
      );
      if (!visita) {
        throw errorDominio(
          HttpStatus.NOT_FOUND,
          'VISITA_NO_ENCONTRADA',
          'La visita no existe o no pertenece a tu cuenta.',
        );
      }
      if (visita.estado !== 'completada') {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'VISITA_NO_COMPLETADA',
          'Solo puedes calificar una visita que hayas finalizado.',
        );
      }

      const [existente] = await m.query(
        `select id_retroalimentacion::int
           from retroalimentacion
          where visita_id = $1`,
        [visitaId],
      );
      if (existente) {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'VISITA_YA_CALIFICADA',
          'Ya calificaste esta visita.',
        );
      }

      const [experiencia] = await m.query(
        `insert into retroalimentacion
           (usuario_id, poi_id, visita_id, calificacion, comentario)
         values ($1, $2, $3, $4, $5)
         returning id_retroalimentacion::int, calificacion, comentario, fecha`,
        [usuarioId, visita.poi_id, visitaId, calificacion, comentario],
      );

      const requiereRevision = discrepancia || calificacion <= 2;
      if (!requiereRevision) {
        return {
          experiencia,
          incidencia: null,
          solicitud: null,
          reporte: null,
          poi: {
            id_poi: visita.poi_id,
            nombre: visita.poi_nombre ?? '',
            estado: visita.poi_estado,
          },
        };
      }

      const tipo = discrepancia
        ? (tipoSolicitado ?? 'discrepancia')
        : 'calificacion_baja';
      const descripcionIncidencia =
        descripcion ??
        comentario ??
        (discrepancia
          ? 'El viajero marcó una discrepancia al calificar la visita.'
          : `El viajero calificó la visita con ${calificacion} de 5.`);

      const [incidencia] = await m.query(
        `insert into incidencia (retroalimentacion_id, tipo, descripcion)
         values ($1, $2, $3)
         returning id_incidencia::int, tipo, estado, fecha_creacion`,
        [experiencia.id_retroalimentacion, tipo, descripcionIncidencia],
      );

      // El reporte entra a la cola de moderación (M03/M04) y deja el POI
      // fuera del mapa público hasta que la comunidad lo re-verifique.
      const [reporte] = await m.query(
        `insert into reporte
           (poi_id, usuario_creador_id, tipo, descripcion, estado, es_critico)
         values ($1, $2, 'reverificacion', $3, 'pendiente_validacion', $4)
         returning id_reporte::int, estado`,
        [
          visita.poi_id,
          usuarioId,
          descripcionIncidencia,
          calificacion <= 2,
        ],
      );

      const [solicitud] = await m.query(
        `insert into solicitud_reverificacion
           (incidencia_id, reporte_generado_id, estado)
         values ($1, $2, 'pendiente')
         returning id_solicitud::int, estado`,
        [incidencia.id_incidencia, reporte.id_reporte],
      );

      await m.query(
        `update poi
            set estado = 'en_revision', fecha_actualizacion = now()
          where id_poi = $1`,
        [visita.poi_id],
      );

      await m.query(
        `insert into registro_auditoria (usuario_id, accion, detalle)
         values ($1, 'reverificacion_automatica',
                 jsonb_build_object(
                   'visita_id', $2::bigint,
                   'poi_id', $3::bigint,
                   'incidencia_id', $4::bigint,
                   'reporte_id', $5::bigint,
                   'calificacion', $6::int,
                   'discrepancia', $7::boolean
                 ))`,
        [
          usuarioId,
          visitaId,
          visita.poi_id,
          incidencia.id_incidencia,
          reporte.id_reporte,
          calificacion,
          discrepancia,
        ],
      );

      return {
        experiencia,
        incidencia,
        solicitud,
        reporte,
        poi: {
          id_poi: visita.poi_id,
          nombre: visita.poi_nombre ?? '',
          estado: 'en_revision',
        },
      };
    });
  }

  /** GET /pois/:id/experiences — experiencias públicas, sin datos personales. */
  async experienciasDePoi(poiIdRaw: unknown) {
    const poiId = enteroPositivo(poiIdRaw, 'id');

    const [poi] = await this.db.query(
      `select id_poi::int, nombre from poi where id_poi = $1`,
      [poiId],
    );
    if (!poi) {
      throw errorDominio(
        HttpStatus.NOT_FOUND,
        'POI_NO_ENCONTRADO',
        'El lugar no existe.',
      );
    }

    const [filas, [resumen]] = await Promise.all([
      this.db.query(
        `select r.id_retroalimentacion::int, r.calificacion, r.comentario,
                r.fecha, v.fecha_fin as fecha_visita
           from retroalimentacion r
           left join visita v on v.id_visita = r.visita_id
          where r.poi_id = $1
          order by r.fecha desc
          limit 50`,
        [poiId],
      ),
      this.db.query(
        `select count(*)::int as total,
                coalesce(round(avg(calificacion)::numeric, 1), 0)::float8 as promedio
           from retroalimentacion
          where poi_id = $1`,
        [poiId],
      ),
    ]);

    return {
      poi_id: poiId,
      poi_nombre: poi.nombre,
      total: resumen?.total ?? 0,
      promedio: resumen?.promedio ?? 0,
      experiencias: (filas as {
        id_retroalimentacion: number;
        calificacion: number;
        comentario: string | null;
        fecha: string;
        fecha_visita: string | null;
      }[]).map((fila) => ({
        id: fila.id_retroalimentacion,
        calificacion: fila.calificacion,
        comentario: fila.comentario ?? '',
        fecha: fila.fecha,
        fecha_visita: fila.fecha_visita,
        autor: 'Viajero de la comunidad',
        perfil:
          fila.calificacion >= 4
            ? 'Experiencia positiva'
            : 'Experiencia con mejoras',
      })),
    };
  }

  /** GET /incidents — incidencias propias del viajero (seguimiento). */
  async incidenciasDeUsuario(usuarioId: string) {
    return this.db.query(
      `select i.id_incidencia::int, i.tipo, i.descripcion, i.estado,
              i.fecha_creacion, p.id_poi::int as poi_id, p.nombre as poi_nombre,
              p.direccion as poi_direccion, r.calificacion, r.comentario
         from incidencia i
         join retroalimentacion r
           on r.id_retroalimentacion = i.retroalimentacion_id
         join poi p on p.id_poi = r.poi_id
        where r.usuario_id = $1
        order by i.fecha_creacion desc
        limit 50`,
      [usuarioId],
    );
  }
}
