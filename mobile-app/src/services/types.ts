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
  autor: string;
  perfil: string;
  calificacion: number;
  comentario: string;
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
}

export interface Coordenada {
  latitude: number;
  longitude: number;
}

/** Resultado normalizado del motor de ruteo (Valhalla vía backend). */
export interface ResultadoRuta {
  distanciaKm: number;
  duracionMin: number;
  /** Geometría decodificada de la ruta, si el backend la entrega. */
  coordenadas?: Coordenada[];
}
