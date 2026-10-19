import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { errorDominio } from '../common/errores';
import { exigirModerador } from '../common/exigir-moderador';

/** Gravedad de una incidencia según la calificación del viajero (1–5). */
const SQL_GRAVEDAD = `case when r.calificacion <= 1 then 'alta'
                          when r.calificacion = 2 then 'media'
                          else 'baja' end`;

/**
 * Panel de moderación (M02, M06, M07) y Proceso 3 (incidencias post-viaje).
 * Todas las operaciones verifican el rol en la BD (RNF-09).
 */
@Injectable()
export class ModeracionService {
  constructor(@InjectDataSource() private readonly db: DataSource) { }

  /** M02 + M07: cifras del tablero y del perfil del moderador. */
  async resumen(usuarioId: string) {
    await exigirModerador(this.db, usuarioId);

    const [[cifras], alertasCriticas, actividadReciente, [desempeno]] = await Promise.all([
      this.db.query(
        `select
           (select count(*)::int from reporte where estado = 'pendiente_validacion') as pendientes,
           (select count(*)::int from incidencia where estado in ('abierta', 'en_proceso')) as discrepancias,
           (select count(*)::int from reporte
             where estado = 'publicado' and fecha_resolucion >= date_trunc('day', now())) as verificados_hoy`,
      ),
      this.db.query(
        `select r.id_reporte::int, r.tipo, r.fecha_creacion, p.nombre as poi_nombre, p.direccion,
                (select count(*)::int from confirmacion c where c.reporte_id = r.id_reporte) as confirmaciones,
                (select e.storage_key from evidencia e where e.reporte_id = r.id_reporte
                  order by e.id_evidencia limit 1) as evidencia
           from reporte r join poi p on p.id_poi = r.poi_id
          where r.estado = 'pendiente_validacion' and r.es_critico is true
          order by r.fecha_creacion asc
          limit 3`,
      ),
      this.db.query(
        `select m.id_moderacion::int, m.accion, m.fecha, p.nombre as poi_nombre, r.tipo
           from moderacion m
           join reporte r on r.id_reporte = m.reporte_id
           join poi p on p.id_poi = r.poi_id
          order by m.fecha desc
          limit 5`,
      ),
      this.db.query(
        `select
           (select count(*)::int from reporte) as recibidos,
           (select count(*)::int from reporte where estado in ('publicado', 'rechazado')) as resueltos,
           (select count(*)::int from moderacion
             where moderador_id = $1 and fecha >= date_trunc('month', now())) as procesados_mes,
           (select count(*)::int from moderacion
             where moderador_id = $1
               and fecha >= date_trunc('month', now()) - interval '1 month'
               and fecha < date_trunc('month', now())) as procesados_mes_anterior,
           (select round((extract(epoch from avg(r.fecha_resolucion - r.fecha_creacion)) / 3600)::numeric, 1)::float8
              from reporte r
             where r.via_resolucion = 'manual'
               and r.fecha_resolucion >= date_trunc('month', now())) as horas_promedio`,
        [usuarioId],
      ),
    ]);

    const tasa = desempeno.recibidos > 0
      ? Math.round((desempeno.resueltos / desempeno.recibidos) * 100)
      : 0;

    return {
      pendientes: cifras.pendientes,
      discrepancias: cifras.discrepancias,
      verificadosHoy: cifras.verificados_hoy,
      alertasCriticas,
      actividadReciente,
      desempeno: {
        tasaResolucion: tasa,
        procesadosMes: desempeno.procesados_mes,
        procesadosMesAnterior: desempeno.procesados_mes_anterior,
        horasPromedio: desempeno.horas_promedio,
      },
    };
  }

  /** M06: incidencias post-viaje abiertas o en proceso, las graves primero. */
  async incidencias(usuarioId: string) {
    await exigirModerador(this.db, usuarioId);
    return this.db.query(
      `select i.id_incidencia::int, i.tipo, i.descripcion, i.estado, i.fecha_creacion,
              r.comentario, r.calificacion, u.email as autor,
              p.id_poi::int as poi_id, p.nombre as poi_nombre, p.direccion as poi_direccion,
              p.tipo as poi_tipo, p.estado as poi_estado,
              ${SQL_GRAVEDAD} as gravedad
         from incidencia i
         join retroalimentacion r on r.id_retroalimentacion = i.retroalimentacion_id
         join poi p on p.id_poi = r.poi_id
         left join usuario u on u.id_usuario = r.usuario_id
        where i.estado in ('abierta', 'en_proceso')
        order by r.calificacion asc, i.fecha_creacion asc`,
    );
  }

  /** M06 «Desactivar punto del mapa»: el POI vuelve a revisión y se cierra la incidencia. */
  async desactivarPunto(usuarioId: string, incidenciaId: number) {
    await exigirModerador(this.db, usuarioId);
    return this.db.transaction(async (m) => {
      const poiId = await this.poiDeIncidenciaAbierta(m.query.bind(m), incidenciaId);
      await m.query(
        `update poi set estado = 'en_revision', fecha_actualizacion = now() where id_poi = $1`,
        [poiId],
      );
      await m.query(
        `update incidencia set estado = 'resuelta', fecha_resolucion = now()
          where id_incidencia = $1`,
        [incidenciaId],
      );
      await m.query(
        `insert into registro_auditoria (usuario_id, accion, detalle)
         values ($1, 'desactivar_poi', jsonb_build_object('incidencia_id', $2::bigint, 'poi_id', $3::bigint))`,
        [usuarioId, incidenciaId, poiId],
      );
      return { incidencia: incidenciaId, poi: poiId, estadoPoi: 'en_revision' };
    });
  }

  /** M06 «Solicitar nueva evidencia a la comunidad»: abre una re-verificación. */
  async solicitarEvidencia(usuarioId: string, incidenciaId: number) {
    await exigirModerador(this.db, usuarioId);
    return this.db.transaction(async (m) => {
      const poiId = await this.poiDeIncidenciaAbierta(m.query.bind(m), incidenciaId);
      const [abierta] = await m.query(
        `select id_solicitud::int from solicitud_reverificacion
          where incidencia_id = $1 and estado in ('pendiente', 'en_proceso')`,
        [incidenciaId],
      );
      const solicitudId: number = abierta
        ? abierta.id_solicitud
        : (
            await m.query(
              `insert into solicitud_reverificacion (incidencia_id, estado)
               values ($1, 'pendiente') returning id_solicitud::int`,
              [incidenciaId],
            )
          )[0].id_solicitud;
      await m.query(
        `update incidencia set estado = 'en_proceso' where id_incidencia = $1`,
        [incidenciaId],
      );
      await m.query(
        `insert into registro_auditoria (usuario_id, accion, detalle)
         values ($1, 'solicitar_reverificacion', jsonb_build_object('incidencia_id', $2::bigint, 'poi_id', $3::bigint))`,
        [usuarioId, incidenciaId, poiId],
      );
      return { incidencia: incidenciaId, solicitud: solicitudId, estado: 'en_proceso' };
    });
  }

  private async poiDeIncidenciaAbierta(
    query: (sql: string, params: unknown[]) => Promise<{ poi_id: number; estado: string }[]>,
    incidenciaId: number,
  ): Promise<number> {
    const [fila] = await query(
      `select r.poi_id::int, i.estado
         from incidencia i
         join retroalimentacion r on r.id_retroalimentacion = i.retroalimentacion_id
        where i.id_incidencia = $1
        for update of i`,
      [incidenciaId],
    );
    if (!fila) {
      throw errorDominio(HttpStatus.NOT_FOUND, 'INCIDENCIA_NO_ENCONTRADA', 'La incidencia no existe.');
    }
    if (fila.estado === 'resuelta') {
      throw errorDominio(HttpStatus.CONFLICT, 'INCIDENCIA_RESUELTA', 'Esta incidencia ya fue resuelta.');
    }
    return fila.poi_id;
  }
}
