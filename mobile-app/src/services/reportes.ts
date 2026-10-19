import { apiFetch } from './api/client';
import type {
  AccionModeracion,
  ReporteComunitario,
  ReporteModeracion,
  ReporteResumen,
  ResultadoConfirmacion,
  ValorCaracteristicaReporte,
  ValorPropuestoReporte,
} from './types';

/**
 * Proceso 1 — Validación colaborativa (escritura).
 *
 * El front NO toca la base de datos: llama a los endpoints transaccionales
 * del backend NestJS (PostgreSQL en AWS RDS):
 *   POST /reportes · POST /reportes/:id/confirmaciones ·
 *   GET /pois/:id/reporte-activo · GET /moderacion/reportes ·
 *   POST /moderacion/reportes/:id/decision
 * El consenso de 3 confirmaciones es atómico (RNF-18/23/28) y la
 * anti-autoconfirmación y el rol de moderación se validan en el servidor.
 */

/** Códigos de error que el backend devuelve como `'CODIGO: mensaje'`. */
export type CodigoErrorReporte =
  | 'USUARIO_NO_VINCULADO'
  | 'AUTOCONFIRMACION'
  | 'CONFIRMACION_DUPLICADA'
  | 'REPORTE_RECHAZADO'
  | 'REPORTE_NO_ENCONTRADO'
  | 'POI_NO_ENCONTRADO'
  | 'ACCESO_DENEGADO'
  | 'MOTIVO_REQUERIDO'
  | 'ACCION_INVALIDA'
  | 'DATOS_INCOMPLETOS'
  | 'DESCONOCIDO';

/** Mensajes en español para cada código (los que no llegan de la BD). */
const MENSAJES_POR_CODIGO: Record<CodigoErrorReporte, string> = {
  USUARIO_NO_VINCULADO: 'Inicia sesión de nuevo para continuar.',
  AUTOCONFIRMACION: 'No puedes confirmar tu propio reporte.',
  CONFIRMACION_DUPLICADA: 'Ya confirmaste este reporte antes.',
  REPORTE_RECHAZADO: 'Este reporte fue rechazado por moderación.',
  REPORTE_NO_ENCONTRADO: 'El reporte ya no está disponible.',
  POI_NO_ENCONTRADO: 'El lugar seleccionado ya no existe.',
  ACCESO_DENEGADO: 'Solo las cuentas de moderación pueden hacer esto.',
  MOTIVO_REQUERIDO: 'Escribe el motivo del rechazo.',
  ACCION_INVALIDA: 'La acción de moderación no es válida.',
  DATOS_INCOMPLETOS: 'Completa el nombre y la ubicación del lugar.',
  DESCONOCIDO: 'No pudimos completar la operación. Inténtalo de nuevo.',
};

/** Error tipado de las operaciones del Proceso 1. */
export class ReporteError extends Error {
  readonly codigo: CodigoErrorReporte;

  constructor(codigo: CodigoErrorReporte, mensaje: string) {
    super(mensaje);
    this.name = 'ReporteError';
    this.codigo = codigo;
  }
}

/**
 * Traduce el mensaje crudo del backend (`'CODIGO: mensaje'`) a un error
 * tipado. Cualquier mensaje ajeno a la convención se degrada a DESCONOCIDO
 * con un texto amable (p. ej. fallos de red o de permisos).
 */
export function mapearErrorReporte(mensajeCrudo: string): ReporteError {
  const texto = (mensajeCrudo ?? '').trim();
  const separador = texto.indexOf(':');
  const posibleCodigo = (separador > 0 ? texto.slice(0, separador) : texto)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const conocido = posibleCodigo in MENSAJES_POR_CODIGO;

  if (!conocido) {
    return new ReporteError('DESCONOCIDO', MENSAJES_POR_CODIGO.DESCONOCIDO);
  }
  const codigo = posibleCodigo as CodigoErrorReporte;
  const mensajeDetalle = separador > 0 ? texto.slice(separador + 1).trim() : '';
  return new ReporteError(
    codigo,
    mensajeDetalle || MENSAJES_POR_CODIGO[codigo],
  );
}

/** Fila cruda de `reporte` usada por el detalle del POI (U08). */
interface FilaReporte {
  id_reporte: number;
  poi_id: number;
  estado: string;
  es_critico: boolean | null;
  fecha_creacion: string;
}

/**
 * Normaliza una fila de `reporte` + su conteo de confirmaciones al contrato
 * del front. El reporte ACTIVO es el más reciente no rechazado.
 */
export function mapearReporteComunitario(
  fila: FilaReporte,
  confirmaciones: number,
): ReporteComunitario {
  return {
    id: String(fila.id_reporte),
    poiId: String(fila.poi_id),
    estado: (fila.estado ?? '').trim().toLowerCase(),
    esCritico: fila.es_critico === true,
    confirmaciones,
  };
}

/** Fila cruda que devuelve `GET /moderacion/reportes`. */
interface FilaReporteModeracion {
  id_reporte: number;
  tipo: string | null;
  estado: string;
  descripcion: string | null;
  fecha_creacion: string;
  es_critico: boolean | null;
  autor: string | null;
  confirmaciones: number | null;
  poi: {
    id_poi: number;
    nombre: string;
    tipo: string;
    direccion: string | null;
    estado: string;
    lat: number | null;
    lon: number | null;
  };
  valores:
    | {
        caracteristica_id: number;
        nombre: string;
        valor_texto: string | null;
        valor_numerico: number | null;
        valor_booleano: boolean | null;
      }[]
    | null;
  evidencia:
    | {
        id_evidencia: number;
        tipo: string | null;
        storage_key: string | null;
      }[]
    | null;
}

/** Traduce la fila anidada del backend al contrato del front (M03–M05). */
export function mapearReporteModeracion(
  fila: FilaReporteModeracion,
): ReporteModeracion {
  const valores: ValorCaracteristicaReporte[] = (fila.valores ?? []).map(
    (valor) => ({
      caracteristicaId: valor.caracteristica_id,
      nombre: valor.nombre,
      valorBooleano: valor.valor_booleano ?? undefined,
      valorNumerico: valor.valor_numerico ?? undefined,
      valorTexto: valor.valor_texto ?? undefined,
    }),
  );

  return {
    id: String(fila.id_reporte),
    tipo: fila.tipo ?? 'nuevo',
    estado: (fila.estado ?? '').trim().toLowerCase(),
    descripcion: fila.descripcion ?? '',
    fechaCreacion: fila.fecha_creacion,
    esCritico: fila.es_critico === true,
    autor: fila.autor,
    confirmaciones: fila.confirmaciones ?? 0,
    poi: {
      id: String(fila.poi.id_poi),
      nombre: fila.poi.nombre,
      tipo: fila.poi.tipo,
      direccion: fila.poi.direccion ?? '',
      estado: (fila.poi.estado ?? '').trim().toLowerCase(),
      lat: fila.poi.lat ?? undefined,
      lon: fila.poi.lon ?? undefined,
    },
    valores,
    evidencia: (fila.evidencia ?? []).map((evidencia) => ({
      id: String(evidencia.id_evidencia),
      tipo: evidencia.tipo ?? 'foto',
      storageKey: evidencia.storage_key ?? '',
    })),
  };
}

/** Datos capturados por el wizard de reporte. */
export interface DatosNuevoReporte {
  /** POI existente a actualizar; null cuando es un lugar nuevo. */
  poiId?: string | null;
  nombre?: string;
  tipoPoi?: string;
  direccion?: string;
  lat?: number;
  lon?: number;
  descripcion: string;
  esCritico: boolean;
  caracteristicas: ValorPropuestoReporte[];
  /** `storageKey` de la foto ya subida con `POST /evidencias` (opcional). */
  evidenciaStorageKey?: string | null;
}

/** Llama al backend y traduce sus errores `'CODIGO: mensaje'`. */
async function llamarBackend<T>(ruta: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(ruta, init);
  } catch (error) {
    throw mapearErrorReporte(error instanceof Error ? error.message : '');
  }
}

/** Crea un reporte comunitario (U09/U10) y devuelve sus identificadores. */
export async function crearReporte(
  datos: DatosNuevoReporte,
): Promise<{ idReporte: string; idPoi: string }> {
  // Un lugar existente SIEMPRE viaja con su id numérico de la BD. Antes, un id
  // no numérico se convertía en null y el backend lo trataba como lugar nuevo
  // sin nombre («El lugar necesita nombre y ubicación»).
  const poiId =
    datos.poiId == null || datos.poiId === '' ? null : Number(datos.poiId);
  if (poiId !== null && !Number.isInteger(poiId)) {
    throw new ReporteError(
      'POI_NO_ENCONTRADO',
      'Ese lugar no está registrado en la base de datos. Toca Reintentar para cargar los lugares reales y vuelve a elegirlo.',
    );
  }

  const resultado = await llamarBackend<{
    id_reporte: number;
    id_poi: number;
  } | null>('/reportes', {
    method: 'POST',
    body: JSON.stringify({
      poiId,
      nombre: datos.nombre ?? null,
      tipoPoi: datos.tipoPoi ?? null,
      direccion: datos.direccion ?? null,
      lat: datos.lat ?? null,
      lon: datos.lon ?? null,
      descripcion: datos.descripcion,
      esCritico: datos.esCritico,
      caracteristicas: datos.caracteristicas.map((valor) => ({
        caracteristicaId: valor.caracteristicaId,
        valorBooleano: valor.valorBooleano,
        valorNumerico: valor.valorNumerico,
        valorTexto: valor.valorTexto,
      })),
      evidenciaStorageKey: datos.evidenciaStorageKey ?? null,
    }),
  });

  if (!resultado) {
    throw new ReporteError('DESCONOCIDO', MENSAJES_POR_CODIGO.DESCONOCIDO);
  }

  return {
    idReporte: String(resultado.id_reporte),
    idPoi: String(resultado.id_poi),
  };
}

/**
 * Registra una confirmación comunitaria (C3). A la tercera confirmación de
 * usuarios independientes el backend publica el punto y `publicado` llega en true.
 */
export async function confirmarReporte(
  reporteId: string,
): Promise<ResultadoConfirmacion> {
  const resultado = await llamarBackend<{
    confirmaciones: number;
    publicado: boolean;
  } | null>(`/reportes/${Number(reporteId)}/confirmaciones`, {
    method: 'POST',
  });

  return {
    confirmaciones: resultado?.confirmaciones ?? 0,
    publicado: resultado?.publicado === true,
  };
}

/**
 * Reporte vigente de un POI (el más reciente no rechazado) con su conteo de
 * confirmaciones. `null` cuando el punto aún no tiene reportes comunitarios.
 */
export async function obtenerReporteDePoi(
  poiId: string,
): Promise<ReporteComunitario | null> {
  let respuesta: {
    reporte: (FilaReporte & { confirmaciones: number }) | null;
  };
  try {
    respuesta = await apiFetch(`/pois/${Number(poiId)}/reporte-activo`);
  } catch (error) {
    throw new Error(
      `No se pudo leer el reporte: ${error instanceof Error ? error.message : ''}`,
    );
  }

  const { reporte } = respuesta;
  return reporte
    ? mapearReporteComunitario(reporte, reporte.confirmaciones ?? 0)
    : null;
}

/**
 * Lista de reportes para la consola de moderación (M03/M04). La BD valida el
 * rol (moderador/administrador); sin permiso responde ACCESO_DENEGADO.
 * `null` lista todos los estados (filtro «Todos» de la consola).
 */
export async function listarReportesModeracion(
  estado: string | null = 'pendiente_validacion',
): Promise<ReporteModeracion[]> {
  const consulta = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  const filas = await llamarBackend<FilaReporteModeracion[]>(
    `/moderacion/reportes${consulta}`,
  );
  return (filas ?? []).map(mapearReporteModeracion);
}

/**
 * Decisión ejecutiva del moderador (Vía B): aprobar publica el punto;
 * rechazar exige motivo y queda auditado (RNF-22/30).
 */
export async function decidirReporte(
  reporteId: string,
  accion: AccionModeracion,
  motivo?: string,
): Promise<{ estado: string }> {
  const resultado = await llamarBackend<{ estado: string } | null>(
    `/moderacion/reportes/${Number(reporteId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ accion, motivo: motivo?.trim() || null }),
    },
  );
  return { estado: resultado?.estado ?? accion };
}

/** Fila de `reporte` que devuelven los listados del viajero en el backend. */
interface FilaResumenReporte {
  id_reporte: number;
  poi_id: number;
  tipo: string | null;
  estado: string;
  descripcion: string | null;
  es_critico: boolean | null;
  fecha_creacion: string;
  confirmaciones: number | null;
}

function mapearResumen(fila: FilaResumenReporte): ReporteResumen {
  return {
    id: String(fila.id_reporte),
    poiId: String(fila.poi_id),
    tipo: fila.tipo ?? 'nuevo',
    estado: (fila.estado ?? '').trim().toLowerCase(),
    descripcion: fila.descripcion ?? '',
    esCritico: fila.es_critico === true,
    fechaCreacion: fila.fecha_creacion,
    confirmaciones: Number(fila.confirmaciones ?? 0),
  };
}

/**
 * Reportes creados por la sesión activa ("Mis reportes" de U12), del más
 * reciente al más antiguo (`GET /reportes/mios`, exige sesión).
 */
export async function listarMisReportes(): Promise<ReporteResumen[]> {
  const filas = await llamarBackend<FilaResumenReporte[]>('/reportes/mios');
  return (filas ?? []).map(mapearResumen);
}

/**
 * Barreras críticas vigentes de la comunidad (reportes con `es_critico` que
 * no fueron rechazados). Alimenta los marcadores naranja del mapa (U06):
 * escaleras, aceras rotas, ascensores dañados… reportados por otros viajeros.
 */
export async function listarBarrerasComunitarias(): Promise<ReporteResumen[]> {
  const filas = await llamarBackend<FilaResumenReporte[]>('/reportes/barreras');
  return (filas ?? []).map(mapearResumen);
}
