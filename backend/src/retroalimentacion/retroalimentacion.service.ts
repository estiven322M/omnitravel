import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { errorDominio } from '../common/errores';

/**
 * Proceso 3 — Gestión de Retroalimentación e Incidencias Post-Viaje.
 *
 * Al finalizar una ruta (U07) o una visita (U08), el viajero califica el lugar
 * (1–5), deja un comentario opcional e indica si la accesibilidad publicada
 * coincidía con lo que encontró. La experiencia queda en `retroalimentacion`
 * (y alimenta la ficha del lugar). Si hay discrepancia o la calificación es
 * baja, se abre una `incidencia` que el moderador atiende en M06; desde allí
 * se solicita la re-verificación al Proceso 1 o se desactiva el punto.
 */

/** Calificación a partir de la cual (hacia abajo) se escala a incidencia. */
export const CALIFICACION_ESCALAMIENTO = 2;
export const LARGO_MAX_COMENTARIO = 500;
export const LARGO_MIN_DESCRIPCION = 10;
/** Una persona solo deja una experiencia por lugar cada 24 horas (anti-spam). */
export const HORAS_ENTRE_RETROALIMENTACIONES = 24;

/** Tipos de discrepancia que ofrece la pantalla post-viaje. */
export const TIPOS_DISCREPANCIA = [
  'barrera_nueva',
  'caracteristica_inexistente',
  'dato_desactualizado',
  'otro',
] as const;
export type TipoDiscrepancia = (typeof TIPOS_DISCREPANCIA)[number];

/** Tipo de incidencia cuando no hay discrepancia, solo una calificación baja. */
export const TIPO_CALIFICACION_BAJA = 'calificacion_baja';

export type Gravedad = 'alta' | 'media' | 'baja';

export interface DatosRetroalimentacion {
  poiId?: number | string | null;
  calificacion?: number | null;
  comentario?: string | null;
  /** true: la accesibilidad coincidía con lo publicado. */
  coincide?: boolean | null;
  tipoDiscrepancia?: string | null;
  descripcionDiscrepancia?: string | null;
}

export interface RetroalimentacionValida {
  poiId: string;
  calificacion: number;
  comentario: string;
  discrepancia: { tipo: TipoDiscrepancia; descripcion: string } | null;
}

/** Misma regla que `SQL_GRAVEDAD` de M06 (moderacion.service.ts). */
export function gravedadDe(calificacion: number): Gravedad {
  if (calificacion <= 1) return 'alta';
  if (calificacion === 2) return 'media';
  return 'baja';
}

/** Se abre incidencia si hay discrepancia o la calificación es ≤ 2. */
export function debeEscalar(
  calificacion: number,
  hayDiscrepancia: boolean,
): boolean {
  return hayDiscrepancia || calificacion <= CALIFICACION_ESCALAMIENTO;
}

/** Valida y normaliza la retroalimentación; lanza 400 con el código del problema. */
export function validarRetroalimentacion(
  datos: DatosRetroalimentacion,
): RetroalimentacionValida {
  const poiId = datos?.poiId == null ? '' : String(datos.poiId).trim();
  if (!/^\d+$/.test(poiId)) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'DATOS_INCOMPLETOS',
      'Indica el lugar que visitaste.',
    );
  }
  const calificacion = datos.calificacion;
  if (
    typeof calificacion !== 'number' ||
    !Number.isInteger(calificacion) ||
    calificacion < 1 ||
    calificacion > 5
  ) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'CALIFICACION_INVALIDA',
      'La calificación debe ser un número entero de 1 a 5.',
    );
  }
  const comentario = (datos.comentario ?? '').trim();
  if (comentario.length > LARGO_MAX_COMENTARIO) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'COMENTARIO_MUY_LARGO',
      `El comentario admite máximo ${LARGO_MAX_COMENTARIO} caracteres.`,
    );
  }

  if (datos.coincide !== false) {
    return { poiId, calificacion, comentario, discrepancia: null };
  }
  const tipo = datos.tipoDiscrepancia as TipoDiscrepancia;
  if (!TIPOS_DISCREPANCIA.includes(tipo)) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'TIPO_DISCREPANCIA_INVALIDO',
      'Elige qué no coincidía con la información publicada.',
    );
  }
  const descripcion = (datos.descripcionDiscrepancia ?? '').trim();
  if (
    descripcion.length < LARGO_MIN_DESCRIPCION ||
    descripcion.length > LARGO_MAX_COMENTARIO
  ) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'DESCRIPCION_REQUERIDA',
      `Describe la discrepancia (entre ${LARGO_MIN_DESCRIPCION} y ${LARGO_MAX_COMENTARIO} caracteres).`,
    );
  }
  return {
    poiId,
    calificacion,
    comentario,
    discrepancia: { tipo, descripcion },
  };
}

@Injectable()
export class RetroalimentacionService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** U13: registra la experiencia y, si corresponde, abre la incidencia para M06. */
  registrar(usuarioId: string, datos: DatosRetroalimentacion) {
    const valida = validarRetroalimentacion(datos);
    return this.db.transaction(async (m) => {
      const [poi] = await m.query('select estado from poi where id_poi = $1', [
        valida.poiId,
      ]);
      if (!poi) {
        throw errorDominio(
          HttpStatus.NOT_FOUND,
          'POI_NO_ENCONTRADO',
          'El lugar no existe.',
        );
      }

      const reciente = await m.query(
        `select 1 from retroalimentacion
          where usuario_id = $1 and poi_id = $2
            and fecha > now() - make_interval(hours => $3)`,
        [usuarioId, valida.poiId, HORAS_ENTRE_RETROALIMENTACIONES],
      );
      if (reciente.length > 0) {
        throw errorDominio(
          HttpStatus.CONFLICT,
          'RETROALIMENTACION_DUPLICADA',
          'Ya calificaste este lugar en las últimas 24 horas.',
        );
      }

      const [retro] = await m.query(
        `insert into retroalimentacion (usuario_id, poi_id, calificacion, comentario, fecha)
         values ($1, $2, $3, $4, now())
         returning id_retroalimentacion::int`,
        [usuarioId, valida.poiId, valida.calificacion, valida.comentario],
      );

      const escalar = debeEscalar(
        valida.calificacion,
        valida.discrepancia !== null,
      );
      let incidenciaId: number | null = null;
      if (escalar) {
        const [incidencia] = await m.query(
          `insert into incidencia (retroalimentacion_id, tipo, descripcion, estado, fecha_creacion)
           values ($1, $2, $3, 'abierta', now())
           returning id_incidencia::int`,
          [
            retro.id_retroalimentacion,
            valida.discrepancia?.tipo ?? TIPO_CALIFICACION_BAJA,
            valida.discrepancia?.descripcion ??
              (valida.comentario ||
                `Calificación de ${valida.calificacion}/5 tras la visita.`),
          ],
        );
        incidenciaId = incidencia.id_incidencia;
      }

      return {
        id_retroalimentacion: retro.id_retroalimentacion,
        id_incidencia: incidenciaId,
        escalada: escalar,
        gravedad: escalar ? gravedadDe(valida.calificacion) : null,
      };
    });
  }

  /** Experiencias propias con el estado de la incidencia que abrieron (si hay). */
  listarMias(usuarioId: string) {
    return this.db.query(
      `select r.id_retroalimentacion::int, r.poi_id::int, p.nombre as poi_nombre,
              r.calificacion, r.comentario, r.fecha,
              i.id_incidencia::int, i.tipo as incidencia_tipo, i.estado as incidencia_estado
         from retroalimentacion r
         join poi p on p.id_poi = r.poi_id
         left join incidencia i on i.retroalimentacion_id = r.id_retroalimentacion
        where r.usuario_id = $1
        order by r.fecha desc
        limit 50`,
      [usuarioId],
    );
  }
}
