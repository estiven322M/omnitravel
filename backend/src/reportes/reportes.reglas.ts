import { HttpStatus } from '@nestjs/common';
import { errorDominio } from '../common/errores';

/**
 * Reglas puras del Proceso 1 (sin base de datos), extraídas de
 * `ReportesService` para poder probarlas de forma unitaria.
 */

/** Confirmaciones de usuarios distintos necesarias para publicar (RNF-18). */
export const CONFIRMACIONES_PARA_PUBLICAR = 3;

export const ESTADO_PENDIENTE_BD = 'pendiente_validacion';
export const ESTADO_PUBLICADO = 'publicado';

/** Campos del reporte que intervienen en la validación de un lugar nuevo. */
export interface DatosLugarReporte {
  poiId?: number | string | null;
  nombre?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/**
 * Valida un reporte antes de guardarlo. Un lugar nuevo (sin `poiId`) exige
 * nombre y ubicación, y la ubicación debe ser una coordenada geográfica
 * válida (latitud −90…90, longitud −180…180). Una actualización de un lugar
 * existente no necesita esos campos: el lugar ya los tiene.
 *
 * Lanza el error de dominio `DATOS_INCOMPLETOS` (400), que la app ya traduce.
 */
export function validarNuevoReporte(datos: DatosLugarReporte): void {
  if (datos.poiId != null && datos.poiId !== '') {
    return;
  }

  const nombre = datos.nombre?.trim() ?? '';
  if (!nombre || !Number.isFinite(datos.lat) || !Number.isFinite(datos.lon)) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'DATOS_INCOMPLETOS',
      'El lugar necesita nombre y ubicación.',
    );
  }

  const lat = datos.lat as number;
  const lon = datos.lon as number;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'DATOS_INCOMPLETOS',
      'La ubicación del lugar está fuera de rango (latitud −90 a 90, longitud −180 a 180).',
    );
  }
}

/**
 * Regla de consenso (RNF-18/RNF-23): con 3 confirmaciones o más el reporte
 * pasa a `publicado`; con menos conserva su estado. Un reporte ya publicado
 * sigue publicado.
 */
export function estadoTrasConfirmaciones(total: number, estadoActual: string): string {
  if (estadoActual === ESTADO_PUBLICADO || total >= CONFIRMACIONES_PARA_PUBLICAR) {
    return ESTADO_PUBLICADO;
  }
  return estadoActual;
}
