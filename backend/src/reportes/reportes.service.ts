import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { errorDominio } from '../common/errores';
import { exigirModerador } from '../common/exigir-moderador';
import { firmarEvidencia, secretoEvidencias } from '../evidencias/firma-evidencia';

/**
 * Proceso 1 — validación colaborativa. Traslada al backend las funciones
 * RPC que la app usaba en Supabase (docs/gestion/supabase-sara/
 * peticiones-front-entrega2.sql) sobre el esquema de AWS:
 *
 * - `reporte.estado` usa los valores reales del CHECK de la BD
 *   ('pendiente_validacion' | 'en_revision' | 'publicado' | 'rechazado') y la
 *   app los recibe tal cual. Se sigue aceptando 'pendiente' (formato heredado)
 *   como filtro de entrada.
 * - Las decisiones del moderador se registran en la tabla `moderacion`
 *   (accion 'aprobar' | 'rechazar') y en `reporte.via_resolucion`.
 */

const CONFIRMACIONES_PARA_PUBLICAR = 3;

/** C4: motivos aceptados para denunciar un reporte (CHECK de la tabla `denuncia`). */
export const MOTIVOS_DENUNCIA = [
  'informacion_falsa',
  'spam',
  'contenido_inapropiado',
  'otro',
] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number];
const MAX_DESCRIPCION_DENUNCIA = 500;

/** Columnas de la consulta de solo lectura (`GET /reportes`, `GET /reportes/:id`). */
const SELECT_CONSULTA = `select id_reporte::text, poi_id::text, usuario_creador_id::text, tipo,
         descripcion, estado, via_resolucion, fecha_creacion, fecha_resolucion
    from reporte`;
const ESTADO_PENDIENTE_BD = 'pendiente_validacion';

/** Estado de BD → estado que recibe la app (sin traducción). */
export function estadoParaApp(estado: string): string {
  return estado;
}

/** Estado que envía la app → estado de BD ('pendiente' es el formato heredado). */
export function estadoParaBd(estado: string): string {
  return estado === 'pendiente' ? ESTADO_PENDIENTE_BD : estado;
}

/** Latitud en [-90, 90] y longitud en [-180, 180]. */
export function coordenadaValida(lat: number, lon: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Columnas del resumen de reporte para los listados del viajero. */
const SELECT_RESUMEN = `select r.id_reporte::int, r.poi_id::int, r.tipo, r.estado, r.descripcion,
              coalesce(r.es_critico, false) as es_critico, r.fecha_creacion,
              (select count(*)::int from confirmacion c where c.reporte_id = r.id_reporte) as confirmaciones
       from reporte r`;

/** Tope de barreras comunitarias que se pintan en el mapa. */
const LIMITE_BARRERAS = 100;

export interface ValorPropuesto {
  caracteristicaId?: number;
  valorBooleano?: boolean | null;
  valorNumerico?: number | null;
  valorTexto?: string | null;
}

export interface DatosNuevoReporte {
  poiId?: number | string | null;
  nombre?: string | null;
  tipoPoi?: string | null;
  direccion?: string | null;
  lat?: number | null;
  lon?: number | null;
  descripcion?: string | null;
  esCritico?: boolean;
  caracteristicas?: ValorPropuesto[];
  evidenciaStorageKey?: string | null;
}

@Injectable()
export class ReportesService {
  constructor(@InjectDataSource() private readonly db: DataSource) { }

  /** U09/U10: lugar nuevo (crea POI pendiente) o actualización de uno existente. */
  crear(usuarioId: string, datos: DatosNuevoReporte) {
    return this.db.transaction(async (m) => {
      let poiId: string;

      if (datos.poiId == null || datos.poiId === '') {
        const nombre = datos.nombre?.trim() ?? '';
        if (!nombre || !Number.isFinite(datos.lat) || !Number.isFinite(datos.lon)) {
          throw errorDominio(
            HttpStatus.BAD_REQUEST,
            'DATOS_INCOMPLETOS',
            'El lugar necesita nombre y ubicación.',
          );
        }
        if (!coordenadaValida(datos.lat as number, datos.lon as number)) {
          throw errorDominio(
            HttpStatus.BAD_REQUEST,
            'COORDENADAS_INVALIDAS',
            'La ubicación está fuera de rango (latitud ±90, longitud ±180).',
          );
        }
        const [poi] = await m.query(
          `insert into poi (nombre, descripcion, tipo, direccion, ubicacion, estado)
           values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), 'pendiente')
           returning id_poi`,
          [
            nombre,
            datos.descripcion ?? '',
            datos.tipoPoi || 'atraccion',
            datos.direccion ?? '',
            datos.lon,
            datos.lat,
          ],
        );
        poiId = poi.id_poi;
      } else {
        poiId = String(datos.poiId);
        const existe = await m.query('select 1 from poi where id_poi = $1', [poiId]);
        if (existe.length === 0) {
          throw errorDominio(HttpStatus.NOT_FOUND, 'POI_NO_ENCONTRADO', 'El lugar no existe.');
        }
      }

      const [reporte] = await m.query(
        `insert into reporte (poi_id, usuario_creador_id, tipo, estado, descripcion, es_critico)
         values ($1, $2, $3, $4, $5, $6)
         returning id_reporte`,
        [
          poiId,
          usuarioId,
          datos.poiId ? 'actualizacion' : 'nuevo',
          ESTADO_PENDIENTE_BD,
          datos.descripcion ?? '',
          datos.esCritico === true,
        ],
      );
      const reporteId: string = reporte.id_reporte;

      for (const valor of datos.caracteristicas ?? []) {
        if (valor?.caracteristicaId == null) {
          continue;
        }
        await m.query(
          `insert into valor_caracteristica_reporte
             (reporte_id, caracteristica_id, valor_texto, valor_numerico, valor_booleano)
           values ($1, $2, $3, $4, $5)`,
          [
            reporteId,
            valor.caracteristicaId,
            valor.valorTexto ?? null,
            valor.valorNumerico ?? null,
            valor.valorBooleano ?? null,
          ],
        );
      }

      const storageKey = datos.evidenciaStorageKey?.trim();
      if (storageKey) {
        // Solo se aceptan fotos subidas por el mismo usuario (carpeta <id>/).
        if (!storageKey.startsWith(`${usuarioId}/`)) {
          throw errorDominio(
            HttpStatus.FORBIDDEN,
            'ACCESO_DENEGADO',
            'La evidencia no pertenece a tu cuenta.',
          );
        }
        await m.query(
          `insert into evidencia (reporte_id, tipo, storage_key) values ($1, 'foto', $2)`,
          [reporteId, storageKey],
        );
      }

      return { id_reporte: Number(reporteId), id_poi: Number(poiId), estado: ESTADO_PENDIENTE_BD };
    });
  }

  /** C3: tres confirmaciones de usuarios distintos publican el reporte. */
  confirmar(usuarioId: string, reporteId: string) {
    return this.db.transaction(async (m) => {
      // Bloquea el reporte: serializa confirmaciones concurrentes.
      const [reporte] = await m.query(
        `select usuario_creador_id, estado from reporte where id_reporte = $1 for update`,
        [reporteId],
      );
      if (!reporte) {
        throw errorDominio(HttpStatus.NOT_FOUND, 'REPORTE_NO_ENCONTRADO', 'El reporte no existe.');
      }
      if (String(reporte.usuario_creador_id) === String(usuarioId)) {
        throw errorDominio(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'AUTOCONFIRMACION',
          'No puedes confirmar tu propio reporte.',
        );
      }
      if (reporte.estado === 'rechazado') {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'REPORTE_RECHAZADO',
          'Este reporte fue rechazado por moderación.',
        );
      }

      if (reporte.estado === 'en_revision') {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'REPORTE_EN_REVISION',
          'Este reporte fue denunciado y lo está revisando moderación.',
        );
      }

      const duplicada = await m.query(
        'select 1 from confirmacion where reporte_id = $1 and usuario_id = $2',
        [reporteId, usuarioId],
      );
      if (duplicada.length > 0) {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'CONFIRMACION_DUPLICADA',
          'Ya confirmaste este reporte.',
        );
      }

      await m.query(
        `insert into confirmacion (reporte_id, usuario_id, tipo_confirmacion) values ($1, $2, 'confirma')`,
        [reporteId, usuarioId],
      );
      const [{ total }] = await m.query(
        'select count(*)::int as total from confirmacion where reporte_id = $1',
        [reporteId],
      );

      if (total >= CONFIRMACIONES_PARA_PUBLICAR && reporte.estado !== 'publicado') {
        await this.publicar(m, reporteId, 'automatica');
        return { confirmaciones: total, publicado: true };
      }
      return { confirmaciones: total, publicado: reporte.estado === 'publicado' };
    });
  }

  /**
   * C4 / A5: denunciar un reporte por información falsa, spam o contenido
   * inapropiado. La denuncia saca el reporte del consenso automático y lo
   * envía a moderación (vía B, 'en_revision'); queda en la auditoría.
   */
  async denunciar(
    usuarioId: string,
    reporteId: string,
    datos?: { motivo?: unknown; descripcion?: unknown },
  ) {
    const motivo = datos?.motivo;
    if (typeof motivo !== 'string' || !MOTIVOS_DENUNCIA.includes(motivo as MotivoDenuncia)) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'MOTIVO_DENUNCIA_INVALIDO',
        'Elige el motivo de la denuncia.',
      );
    }
    if (datos?.descripcion != null && typeof datos.descripcion !== 'string') {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'DESCRIPCION_INVALIDA',
        'La descripción debe ser texto.',
      );
    }
    const descripcion = (datos?.descripcion as string | undefined)?.trim() || null;
    if (descripcion && descripcion.length > MAX_DESCRIPCION_DENUNCIA) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'DESCRIPCION_INVALIDA',
        `La descripción admite hasta ${MAX_DESCRIPCION_DENUNCIA} caracteres.`,
      );
    }

    return this.db.transaction(async (m) => {
      const [reporte] = await m.query(
        `select usuario_creador_id, estado from reporte where id_reporte = $1 for update`,
        [reporteId],
      );
      if (!reporte) {
        throw errorDominio(HttpStatus.NOT_FOUND, 'REPORTE_NO_ENCONTRADO', 'El reporte no existe.');
      }
      if (String(reporte.usuario_creador_id) === String(usuarioId)) {
        throw errorDominio(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'AUTODENUNCIA',
          'No puedes denunciar tu propio reporte.',
        );
      }
      if (reporte.estado === 'rechazado') {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'REPORTE_RECHAZADO',
          'Este reporte ya fue rechazado por moderación.',
        );
      }
      const previa = await m.query(
        'select 1 from denuncia where reporte_id = $1 and usuario_id = $2',
        [reporteId, usuarioId],
      );
      if (previa.length > 0) {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'DENUNCIA_DUPLICADA',
          'Ya denunciaste este reporte.',
        );
      }

      const [{ id_denuncia: idDenuncia }] = await m.query(
        `insert into denuncia (reporte_id, usuario_id, motivo, descripcion)
         values ($1, $2, $3, $4)
         returning id_denuncia::int`,
        [reporteId, usuarioId, motivo, descripcion],
      );
      await m.query(
        `update reporte set estado = 'en_revision'
          where id_reporte = $1 and estado <> 'en_revision'`,
        [reporteId],
      );
      await m.query(
        `insert into registro_auditoria (usuario_id, accion, detalle)
         values ($1, 'denuncia_reporte', $2::jsonb)`,
        [usuarioId, JSON.stringify({ reporte: Number(reporteId), denuncia: idDenuncia, motivo })],
      );
      const [{ total }] = await m.query(
        `select count(*)::int as total from denuncia where reporte_id = $1 and estado = 'pendiente'`,
        [reporteId],
      );
      return { denuncia: idDenuncia, estado: 'en_revision', denunciasPendientes: total };
    });
  }

  /** Reporte vigente del POI (el más reciente no rechazado) con su conteo. */
  async reporteActivo(poiId: string) {
    const [reporte] = await this.db.query(
      `select r.id_reporte::int, r.poi_id::int, r.estado, r.es_critico, r.fecha_creacion,
              (select count(*)::int from confirmacion c where c.reporte_id = r.id_reporte) as confirmaciones
       from reporte r
       where r.poi_id = $1 and r.estado <> 'rechazado'
       order by r.fecha_creacion desc
       limit 1`,
      [poiId],
    );
    // Objeto envolvente: un cuerpo `null` no es JSON válido para el cliente.
    return { reporte: reporte ? { ...reporte, estado: estadoParaApp(reporte.estado) } : null };
  }

  /** U12 «Mis reportes»: los creados por la persona autenticada, recientes primero. */
  /**
   * GET /reportes?page&limit — consulta paginada de solo lectura, del más
   * reciente al más antiguo (antes en el módulo `reports`, unificado aquí
   * por la auditoría 6.4 ítem 8: un solo módulo por dominio).
   */
  async listarPaginado(pagina: number, limite: number) {
    if (!Number.isInteger(pagina) || pagina < 1) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'El parámetro page debe ser un entero positivo.',
      );
    }
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'El parámetro limit debe estar entre 1 y 100.',
      );
    }
    const [datos, [{ total }]] = await Promise.all([
      this.db.query(
        `${SELECT_CONSULTA}
         order by fecha_creacion desc
         limit $1 offset $2`,
        [limite, (pagina - 1) * limite],
      ),
      this.db.query('select count(*)::int as total from reporte'),
    ]);
    return {
      data: datos,
      meta: { page: pagina, limit: limite, total, totalPages: Math.ceil(total / limite) },
    };
  }

  /** GET /reportes/:id — un reporte (solo lectura) o 404. */
  async obtener(id: string) {
    const [reporte] = await this.db.query(`${SELECT_CONSULTA} where id_reporte = $1`, [id]);
    if (!reporte) {
      throw errorDominio(HttpStatus.NOT_FOUND, 'NOT_FOUND', `No se encontró el reporte con ID ${id}.`);
    }
    return reporte;
  }

  async listarMios(usuarioId: string) {
    return this.db.query(
      `${SELECT_RESUMEN}
       where r.usuario_creador_id = $1
       order by r.fecha_creacion desc`,
      [usuarioId],
    );
  }

  /** U06: barreras críticas vigentes (no rechazadas) para el mapa; público. */
  async listarBarreras() {
    return this.db.query(
      `${SELECT_RESUMEN}
       where r.es_critico is true and r.estado <> 'rechazado'
       order by r.fecha_creacion desc
       limit ${LIMITE_BARRERAS}`,
    );
  }

  /** M03/M04: reportes para la consola de moderación. */
  async listarModeracion(usuarioId: string, estado?: string) {
    await this.exigirModerador(usuarioId);
    const filtro = estado ? estadoParaBd(estado) : null;

    const filas: { fila: Record<string, unknown> & { estado: string } }[] = await this.db.query(
      `select jsonb_build_object(
          'id_reporte', r.id_reporte,
          'tipo', r.tipo,
          'estado', r.estado,
          'descripcion', r.descripcion,
          'fecha_creacion', r.fecha_creacion,
          'fecha_resolucion', r.fecha_resolucion,
          'via_resolucion', r.via_resolucion,
          'es_critico', r.es_critico,
          'autor', u.email,
          'confirmaciones', (select count(*) from confirmacion c where c.reporte_id = r.id_reporte),
          'denuncias', coalesce((
            select jsonb_agg(jsonb_build_object(
              'motivo', d.motivo,
              'descripcion', d.descripcion,
              'fecha', d.fecha_creacion) order by d.fecha_creacion)
            from denuncia d
            where d.reporte_id = r.id_reporte and d.estado = 'pendiente'
          ), '[]'::jsonb),
          'poi', jsonb_build_object(
            'id_poi', p.id_poi,
            'nombre', p.nombre,
            'tipo', p.tipo,
            'direccion', p.direccion,
            'estado', p.estado,
            'lat', ST_Y(p.ubicacion::geometry),
            'lon', ST_X(p.ubicacion::geometry)
          ),
          'valores', coalesce((
            select jsonb_agg(jsonb_build_object(
              'caracteristica_id', v.caracteristica_id,
              'nombre', ca.nombre,
              'valor_texto', v.valor_texto,
              'valor_numerico', v.valor_numerico,
              'valor_booleano', v.valor_booleano))
            from valor_caracteristica_reporte v
            join caracteristica_accesibilidad ca on ca.id_caracteristica = v.caracteristica_id
            where v.reporte_id = r.id_reporte
          ), '[]'::jsonb),
          'evidencia', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id_evidencia', e.id_evidencia,
              'tipo', e.tipo,
              'storage_key', e.storage_key))
            from evidencia e
            where e.reporte_id = r.id_reporte
          ), '[]'::jsonb)
        ) as fila
       from reporte r
       join poi p on p.id_poi = r.poi_id
       left join usuario u on u.id_usuario = r.usuario_creador_id
       where $1::text is null or r.estado = $1
       order by r.es_critico desc, r.fecha_creacion asc`,
      [filtro],
    );

    // Cada foto lleva su permiso temporal de lectura (ver firma-evidencia.ts).
    const secreto = secretoEvidencias();
    return filas.map(({ fila }) => ({
      ...fila,
      estado: estadoParaApp(fila.estado),
      evidencia: ((fila.evidencia ?? []) as { storage_key: string | null }[]).map((e) => ({
        ...e,
        acceso: e.storage_key ? firmarEvidencia(e.storage_key, secreto) : null,
      })),
    }));
  }

  /** M04/M05 (Vía B): aprobar publica; rechazar exige motivo. Queda auditado. */
  async decidir(usuarioId: string, reporteId: string, accion?: string, motivo?: string | null) {
    await this.exigirModerador(usuarioId);

    if (accion !== 'aprobado' && accion !== 'rechazado') {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'ACCION_INVALIDA',
        'Acción de moderación desconocida.',
      );
    }
    const motivoLimpio = motivo?.trim() ?? '';
    if (accion === 'rechazado' && !motivoLimpio) {
      throw errorDominio(HttpStatus.BAD_REQUEST, 'MOTIVO_REQUERIDO', 'El rechazo exige un motivo.');
    }

    return this.db.transaction(async (m) => {
      const [reporte] = await m.query(
        'select 1 from reporte where id_reporte = $1 for update',
        [reporteId],
      );
      if (!reporte) {
        throw errorDominio(HttpStatus.NOT_FOUND, 'REPORTE_NO_ENCONTRADO', 'El reporte no existe.');
      }

      if (accion === 'aprobado') {
        await this.publicar(m, reporteId, 'manual');
      } else {
        await m.query(
          `update reporte
              set estado = 'rechazado', via_resolucion = 'manual', fecha_resolucion = now()
            where id_reporte = $1`,
          [reporteId],
        );
      }

      // A5: la decisión atiende las denuncias pendientes del reporte.
      await m.query(
        `update denuncia set estado = 'atendida', fecha_resolucion = now()
          where reporte_id = $1 and estado = 'pendiente'`,
        [reporteId],
      );

      await m.query(
        `insert into moderacion (reporte_id, moderador_id, accion, motivo) values ($1, $2, $3, $4)`,
        [reporteId, usuarioId, accion === 'aprobado' ? 'aprobar' : 'rechazar', motivoLimpio],
      );

      return { estado: accion === 'aprobado' ? 'publicado' : 'rechazado' };
    });
  }

  /** Publica exactamente una vez y copia los valores a la ficha del POI. */
  private async publicar(m: EntityManager, reporteId: string, via: 'automatica' | 'manual') {
    const [{ poi_id: poiId }] = await m.query(
      'select poi_id from reporte where id_reporte = $1',
      [reporteId],
    );
    await m.query('select 1 from poi where id_poi = $1 for update', [poiId]);

    await m.query(
      `update reporte
          set estado = 'publicado', via_resolucion = $2, fecha_resolucion = now()
        where id_reporte = $1 and estado is distinct from 'publicado'`,
      [reporteId, via],
    );

    await m.query(
      `update valor_accesibilidad_poi v
          set valor_texto = r.valor_texto,
              valor_numerico = r.valor_numerico,
              valor_booleano = r.valor_booleano,
              fecha_actualizacion = now()
         from valor_caracteristica_reporte r
        where v.poi_id = $1 and r.reporte_id = $2 and v.caracteristica_id = r.caracteristica_id`,
      [poiId, reporteId],
    );
    await m.query(
      `insert into valor_accesibilidad_poi
         (poi_id, caracteristica_id, valor_texto, valor_numerico, valor_booleano)
       select $1, r.caracteristica_id, r.valor_texto, r.valor_numerico, r.valor_booleano
         from valor_caracteristica_reporte r
        where r.reporte_id = $2
          and not exists (
            select 1 from valor_accesibilidad_poi v
             where v.poi_id = $1 and v.caracteristica_id = r.caracteristica_id)`,
      [poiId, reporteId],
    );

    await m.query(
      `update poi set estado = 'publicado', fecha_actualizacion = now()
        where id_poi = $1 and estado is distinct from 'publicado'`,
      [poiId],
    );
    // Cierre del ciclo Proceso 3 → Proceso 1: el reporte publicado resuelve las
    // re-verificaciones pendientes del lugar y sus incidencias post-viaje.
    await m.query(
      `with cerradas as (
         update solicitud_reverificacion s
            set estado = 'resuelta', fecha_resolucion = now(), reporte_generado_id = $2
           from incidencia i
           join retroalimentacion r on r.id_retroalimentacion = i.retroalimentacion_id
          where s.incidencia_id = i.id_incidencia
            and r.poi_id = $1
            and s.estado in ('pendiente', 'en_proceso')
         returning s.incidencia_id)
       update incidencia
          set estado = 'resuelta', fecha_resolucion = now()
        where id_incidencia in (select incidencia_id from cerradas)`,
      [poiId, reporteId],
    );
  }

  private exigirModerador(usuarioId: string) {
    return exigirModerador(this.db, usuarioId);
  }

}
