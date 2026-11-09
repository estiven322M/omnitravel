import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Contratos de datos del front-end.
 *
 * Espejo de los contratos definidos en la arquitectura C4 (N3/N4) y del
 * modelo físico PostgreSQL + PostGIS (16 tablas). Mientras el backend expone
 * los endpoints definitivos, estos tipos se alimentan de mocks tipados.
 */

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Tipo de valor del catálogo CARACTERISTICA_ACCESIBILIDAD. */
export type TipoValor = 'BOOLEANO' | 'NUMERICO' | 'TEXTO';

export interface CaracteristicaAccesibilidad {
  id: string;
  nombre: string;
  descripcion?: string;
  tipoValor: TipoValor;
  /** Unidad de medida para valores numéricos (ej. "cm"). */
  unidad?: string;
  icono: IconName;
  /**
   * Id físico en `caracteristica_accesibilidad` de la BD (necesario para
   * escribir reportes); ausente en los mocks de demostración.
   */
  idBd?: number;
}

/** Fila de VALOR_ACCESIBILIDAD_POI (valor vigente por característica). */
export interface ValorAccesibilidad {
  caracteristicaId: string;
  valorBooleano?: boolean;
  valorNumerico?: number;
  valorTexto?: string;
}

export type EstadoVerificacion = 'PENDIENTE' | 'EN_REVISION' | 'VERIFICADO';

/** Retroalimentación de un viajero (tabla RETROALIMENTACION). */
export interface ExperienciaViajero {
  /** Id de la retroalimentación (opcional: el feed heredado no lo envía). */
  id?: number;
  autor: string;
  perfil: string;
  calificacion: number;
  comentario: string;
  /** Fecha de la visita que autorizó la opinión (Proceso 3). */
  fecha?: string;
}

/** Punto de interés (tabla POI + INFORMACION_ACCESIBILIDAD). */
export interface Poi {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  direccion: string;
  ciudad: string;
  latitud: number;
  longitud: number;
  calificacion: number;
  totalExperiencias: number;
  /** Confirmaciones comunitarias (regla de 3 → publicación, Proceso 1). */
  confirmaciones: number;
  estadoVerificacion: EstadoVerificacion;
  ultimaVerificacion: string;
  valores: ValorAccesibilidad[];
  experiencias: ExperienciaViajero[];
  /** Fotos reales del lugar (tabla POI_FOTO, Wikimedia Commons). */
  fotos?: FotoLugar[];
}

/** Foto real de un lugar con su crédito (autor y licencia). */
export interface FotoLugar {
  url: string;
  leyenda: string;
  autor: string | null;
  licencia: string | null;
  fuenteUrl: string | null;
}

export interface Coordenada {
  latitude: number;
  longitude: number;
}

/** Paso de navegación (maneuver de Valhalla normalizado por el backend). */
export interface PasoRuta {
  /** Tipo de maniobra Valhalla (1 inicio, 4 destino, 10 derecha, 15 izquierda…). */
  tipo: number;
  /** Instrucción ya localizada (es-ES) por el motor de ruteo. */
  instruccion: string;
  /** Longitud del tramo en kilómetros. */
  distanciaKm: number;
}

/** Resultado normalizado del motor de ruteo (Valhalla vía backend). */
export interface ResultadoRuta {
  distanciaKm: number;
  duracionMin: number;
  /** Geometría decodificada de la ruta, si el backend la entrega. */
  coordenadas?: Coordenada[];
  /** Perfil de accesibilidad con el que se calculó la ruta. */
  perfil?: string;
  /** Pasos de navegación paso a paso (U07). */
  pasos?: PasoRuta[];
  /** Advertencias del motor y del backend (RNF-27). */
  advertencias?: string[];
  /**
   * Camino alternativo del mismo par origen/destino (Valhalla `alternates`
   * vía backend). La app lo muestra al pulsar «Recalcular ruta» para no
   * repetir el mismo trayecto.
   */
  alternativa?: ResultadoRuta;
}

/** Restricciones de accesibilidad enviadas al motor de ruteo (Proceso 2). */
export interface RestriccionesRuta {
  perfil?: 'peatonal' | 'silla_de_ruedas' | 'visual';
  avoidStairs?: boolean;
  requireElevator?: boolean;
  preferSoundTrafficLights?: boolean;
}

/** Rol de dominio (catálogo `rol` de la BD del equipo). */
export type RolUsuario =
  'viajero' | 'colaborador' | 'establecimiento' | 'moderador' | 'administrador';

/**
 * Reporte comunitario vigente de un POI (tabla `reporte` + conteo de
 * `confirmacion`). Es la unidad de la regla de consenso de 3 (C3).
 */
export interface ReporteComunitario {
  id: string;
  poiId: string;
  estado: string;
  esCritico: boolean;
  confirmaciones: number;
}

/** Resultado de una confirmación comunitaria (RPC `confirmar_reporte`). */
export interface ResultadoConfirmacion {
  /** Total de confirmaciones del reporte tras registrar la del usuario. */
  confirmaciones: number;
  /** true cuando el consenso de 3 publicó el punto (dispara S01). */
  publicado: boolean;
}

/** Valor propuesto por un reporte para una característica del catálogo. */
export interface ValorCaracteristicaReporte {
  caracteristicaId: number;
  nombre: string;
  valorBooleano?: boolean;
  valorNumerico?: number;
  valorTexto?: string;
}

/** Valor propuesto que el wizard envía a la RPC `crear_reporte`. */
export interface ValorPropuestoReporte {
  caracteristicaId: number;
  valorBooleano?: boolean;
  valorNumerico?: number;
  valorTexto?: string;
}

/** Reporte listo para la consola de moderación (M03–M05). */
export interface ReporteModeracion {
  id: string;
  tipo: string;
  estado: string;
  descripcion: string;
  fechaCreacion: string;
  /** Cuándo se publicó o rechazó (null mientras está pendiente). */
  fechaResolucion?: string | null;
  /** 'automatica' (consenso de 3) o 'manual' (decisión del moderador). */
  viaResolucion?: string | null;
  /** Vía B: reportes con barreras críticas que prioriza el moderador. */
  esCritico: boolean;
  autor: string | null;
  confirmaciones: number;
  poi: {
    id: string;
    nombre: string;
    tipo: string;
    direccion: string;
    estado: string;
    lat?: number;
    lon?: number;
  };
  valores: ValorCaracteristicaReporte[];
  evidencia: {
    id: string;
    tipo: string;
    storageKey: string;
    /** Permiso temporal de lectura que firma el backend (`exp=…&firma=…`). */
    acceso: string | null;
  }[];
}

/** Acción ejecutiva del moderador sobre un reporte (M05). */
export type AccionModeracion = 'aprobado' | 'rechazado';

/** Estado físico de un reporte en la tabla `reporte`. */
export type EstadoReporte =
  'pendiente_validacion' | 'en_revision' | 'publicado' | 'rechazado';

/**
 * Resumen de un reporte comunitario para "Mis reportes" (U12) y para los
 * marcadores de barreras del mapa (U06). Se alimenta de la lectura pública de
 * `reporte` + el conteo de confirmaciones de la tabla `confirmacion`.
 */
export interface ReporteResumen {
  id: string;
  poiId: string;
  tipo: string;
  estado: string;
  descripcion: string;
  esCritico: boolean;
  fechaCreacion: string;
  confirmaciones: number;
}
