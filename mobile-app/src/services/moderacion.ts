import { apiFetch } from './api/client';
import { mensajeLegible } from './api/auth';

/**
 * Panel de moderación (M02, M06, M07) contra el backend (`/moderacion/*`).
 * El backend valida el rol en cada llamada; sin permiso responde 403.
 */

export interface AlertaCritica {
  idReporte: string;
  tipo: string;
  fechaCreacion: string;
  poiNombre: string;
  direccion: string;
  confirmaciones: number;
  evidencia: string | null;
}

export interface ActividadModeracion {
  id: string;
  accion: 'aprobar' | 'rechazar' | 'marcar_revision' | string;
  fecha: string;
  poiNombre: string;
  tipo: string;
}

export interface ResumenModeracion {
  pendientes: number;
  discrepancias: number;
  verificadosHoy: number;
  alertasCriticas: AlertaCritica[];
  actividadReciente: ActividadModeracion[];
  desempeno: {
    tasaResolucion: number;
    procesadosMes: number;
    procesadosMesAnterior: number;
    horasPromedio: number | null;
  };
}

export type Gravedad = 'alta' | 'media' | 'baja';

export interface Incidencia {
  id: string;
  tipo: string;
  descripcion: string;
  estado: 'abierta' | 'en_proceso' | string;
  fechaCreacion: string;
  comentario: string;
  autor: string | null;
  gravedad: Gravedad;
  poi: {
    id: string;
    nombre: string;
    direccion: string;
    tipo: string;
    estado: string;
  };
}

async function llamar<T>(ruta: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(ruta, init);
  } catch (error) {
    throw new Error(
      mensajeLegible(error instanceof Error ? error.message : '') ||
        'No fue posible comunicarse con el panel de moderación.',
    );
  }
}

interface ResumenCrudo {
  pendientes: number;
  discrepancias: number;
  verificadosHoy: number;
  alertasCriticas: {
    id_reporte: number;
    tipo: string | null;
    fecha_creacion: string;
    poi_nombre: string;
    direccion: string | null;
    confirmaciones: number;
    evidencia: string | null;
  }[];
  actividadReciente: {
    id_moderacion: number;
    accion: string;
    fecha: string;
    poi_nombre: string;
    tipo: string | null;
  }[];
  desempeno: ResumenModeracion['desempeno'];
}

export async function obtenerResumenModeracion(): Promise<ResumenModeracion> {
  const crudo = await llamar<ResumenCrudo>('/moderacion/resumen');
  return {
    pendientes: crudo.pendientes,
    discrepancias: crudo.discrepancias,
    verificadosHoy: crudo.verificadosHoy,
    desempeno: crudo.desempeno,
    alertasCriticas: crudo.alertasCriticas.map((fila) => ({
      idReporte: String(fila.id_reporte),
      tipo: fila.tipo ?? 'reporte',
      fechaCreacion: fila.fecha_creacion,
      poiNombre: fila.poi_nombre,
      direccion: fila.direccion ?? '',
      confirmaciones: fila.confirmaciones,
      evidencia: fila.evidencia,
    })),
    actividadReciente: crudo.actividadReciente.map((fila) => ({
      id: String(fila.id_moderacion),
      accion: fila.accion,
      fecha: fila.fecha,
      poiNombre: fila.poi_nombre,
      tipo: fila.tipo ?? 'reporte',
    })),
  };
}

interface IncidenciaCruda {
  id_incidencia: number;
  tipo: string | null;
  descripcion: string | null;
  estado: string;
  fecha_creacion: string;
  comentario: string | null;
  autor: string | null;
  gravedad: Gravedad;
  poi_id: number;
  poi_nombre: string;
  poi_direccion: string | null;
  poi_tipo: string | null;
  poi_estado: string;
}

export async function listarIncidencias(): Promise<Incidencia[]> {
  const filas = await llamar<IncidenciaCruda[]>('/moderacion/incidencias');
  return (filas ?? []).map((fila) => ({
    id: String(fila.id_incidencia),
    tipo: fila.tipo ?? 'discrepancia',
    descripcion: fila.descripcion ?? '',
    estado: fila.estado,
    fechaCreacion: fila.fecha_creacion,
    comentario: fila.comentario ?? '',
    autor: fila.autor,
    gravedad: fila.gravedad,
    poi: {
      id: String(fila.poi_id),
      nombre: fila.poi_nombre,
      direccion: fila.poi_direccion ?? '',
      tipo: fila.poi_tipo ?? '',
      estado: fila.poi_estado,
    },
  }));
}

/** M06: el punto vuelve a revisión (sale del mapa público) y se cierra la incidencia. */
export async function desactivarPuntoDeIncidencia(id: string): Promise<void> {
  await llamar(
    `/moderacion/incidencias/${encodeURIComponent(id)}/desactivar-punto`,
    {
      method: 'POST',
    },
  );
}

/** M06: pide a la comunidad nueva evidencia (re-verificación). */
export async function solicitarNuevaEvidencia(id: string): Promise<void> {
  await llamar(
    `/moderacion/incidencias/${encodeURIComponent(id)}/solicitar-evidencia`,
    { method: 'POST' },
  );
}
