import { ApiError, apiFetch } from './client';
import { mensajeLegible } from './auth';

/**
 * Proceso 3 — visitas y retroalimentación post-viaje.
 *
 * El backend solo permite calificar visitas COMPLETADAS y una sola vez por
 * visita. Una calificación ≤ 2 o una discrepancia explícita abre una
 * incidencia y deja el lugar en revisión comunitaria.
 */

export type EstadoVisita = 'en_curso' | 'completada' | 'cancelada';

export interface Visita {
  id_visita: number;
  poi_id: number;
  estado: EstadoVisita;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface PoiDeVisita {
  id_poi: number;
  nombre: string;
  tipo: string;
  direccion: string | null;
}

export interface VisitaIniciada {
  visita: Visita;
  poi: PoiDeVisita;
  /** true si ya había una visita en curso al mismo lugar. */
  reutilizada: boolean;
}

export interface VisitaPendiente {
  id_visita: number;
  poi_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  poi_nombre: string;
  poi_tipo: string;
  poi_direccion: string | null;
}

export type TipoIncidencia =
  'barrera' | 'informacion_incorrecta' | 'cerrado' | 'otro' | 'discrepancia';

export interface DatosExperiencia {
  visita_id: number;
  calificacion: number;
  comentario?: string;
  discrepancia?: boolean;
  tipo_incidencia?: TipoIncidencia;
  descripcion_incidencia?: string;
}

export interface IncidenciaCreada {
  id_incidencia: number;
  tipo: string;
  estado: string;
  fecha_creacion: string;
}

export interface ReporteCreado {
  id_reporte: number;
  estado: string;
}

export interface SolicitudCreada {
  id_solicitud: number;
  estado: string;
}

export interface ResultadoExperiencia {
  experiencia: {
    id_retroalimentacion: number;
    calificacion: number;
    comentario: string | null;
    fecha: string;
  };
  incidencia: IncidenciaCreada | null;
  reporte: ReporteCreado | null;
  solicitud: SolicitudCreada | null;
  poi: {
    id_poi: number;
    nombre: string;
    estado: string;
  };
}

export interface ExperienciaPublica {
  id: number;
  calificacion: number;
  comentario: string;
  fecha: string;
  fecha_visita: string | null;
  autor: string;
  perfil: string;
}

export interface ExperienciasDePoi {
  poi_id: number;
  poi_nombre: string;
  total: number;
  promedio: number;
  experiencias: ExperienciaPublica[];
}

export interface IncidenciaPropia {
  id_incidencia: number;
  tipo: string;
  descripcion: string;
  estado: string;
  fecha_creacion: string;
  poi_id: number;
  poi_nombre: string;
  poi_direccion: string | null;
  calificacion: number;
  comentario: string | null;
}

async function conMensajeLegible<T>(promesa: Promise<T>): Promise<T> {
  try {
    return await promesa;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(mensajeLegible(error.message), error.status);
    }
    throw error;
  }
}

/** POST /visitas — inicia la visita al entrar a la navegación paso a paso. */
export function iniciarVisita(poiId: string | number): Promise<VisitaIniciada> {
  return conMensajeLegible(
    apiFetch<VisitaIniciada>('/visitas', {
      method: 'POST',
      body: JSON.stringify({ poi_id: Number(poiId) }),
    }),
  );
}

/** POST /visitas/:id/finalizar — cierra la visita y habilita su calificación. */
export function finalizarVisita(visitaId: number): Promise<{
  visita: Visita;
  poi: PoiDeVisita;
  yaFinalizada: boolean;
}> {
  return conMensajeLegible(
    apiFetch(`/visitas/${visitaId}/finalizar`, { method: 'POST' }),
  );
}

/** GET /visitas/pendientes — visitas completadas aún sin calificar. */
export function visitasPendientes(): Promise<VisitaPendiente[]> {
  return conMensajeLegible(apiFetch<VisitaPendiente[]>('/visitas/pendientes'));
}

/** POST /experiences — califica una visita completada (una sola vez). */
export function crearExperiencia(
  datos: DatosExperiencia,
): Promise<ResultadoExperiencia> {
  return conMensajeLegible(
    apiFetch<ResultadoExperiencia>('/experiences', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),
  );
}

/** GET /pois/:id/experiences — experiencias públicas, sin datos personales. */
export function experienciasDePoi(
  poiId: string | number,
): Promise<ExperienciasDePoi> {
  return conMensajeLegible(
    apiFetch<ExperienciasDePoi>(`/pois/${poiId}/experiences`),
  );
}

/** GET /incidents — incidencias propias del viajero autenticado. */
export function incidenciasPropias(): Promise<IncidenciaPropia[]> {
  return conMensajeLegible(apiFetch<IncidenciaPropia[]>('/incidents'));
}
