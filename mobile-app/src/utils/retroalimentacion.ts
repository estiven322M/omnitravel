/**
 * Lógica pura de la retroalimentación post-viaje (Proceso 3, U13): opciones,
 * validación del formulario y cuerpo que viaja a `POST /retroalimentacion`.
 * Separada de la pantalla para poder probarla con Jest. Las reglas son las
 * mismas del backend (retroalimentacion.service.ts).
 */

export const LARGO_MAX_COMENTARIO = 500;
export const LARGO_MIN_DESCRIPCION = 10;
/** Con calificación ≤ 2 (o discrepancia) el backend abre una incidencia. */
export const CALIFICACION_ESCALAMIENTO = 2;

export type TipoDiscrepancia =
  | 'barrera_nueva'
  | 'caracteristica_inexistente'
  | 'dato_desactualizado'
  | 'otro';

export const TIPOS_DISCREPANCIA: {
  valor: TipoDiscrepancia;
  etiqueta: string;
  descripcion: string;
}[] = [
  {
    valor: 'barrera_nueva',
    etiqueta: 'Encontré una barrera nueva',
    descripcion: 'Obras, objetos o daños que impiden el paso.',
  },
  {
    valor: 'caracteristica_inexistente',
    etiqueta: 'Una característica no existe',
    descripcion: 'Por ejemplo, la rampa o el baño accesible no están.',
  },
  {
    valor: 'dato_desactualizado',
    etiqueta: 'La información está desactualizada',
    descripcion: 'Medidas, horarios o estados distintos a lo publicado.',
  },
  {
    valor: 'otro',
    etiqueta: 'Otro problema',
    descripcion: 'Cuéntanos qué pasó.',
  },
];

export const ETIQUETA_CALIFICACION: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
};

/** Estado del formulario en edición. */
export interface BorradorRetroalimentacion {
  calificacion: number;
  comentario: string;
  /** null: aún no respondió si la información coincidía. */
  coincide: boolean | null;
  tipoDiscrepancia: TipoDiscrepancia | null;
  descripcionDiscrepancia: string;
}

export const BORRADOR_RETRO_INICIAL: BorradorRetroalimentacion = {
  calificacion: 0,
  comentario: '',
  coincide: null,
  tipoDiscrepancia: null,
  descripcionDiscrepancia: '',
};

export interface ErroresRetroalimentacion {
  calificacion?: string;
  comentario?: string;
  coincide?: string;
  tipoDiscrepancia?: string;
  descripcionDiscrepancia?: string;
}

/** Devuelve los errores por campo; objeto vacío si el formulario es válido. */
export function validarBorradorRetro(
  borrador: BorradorRetroalimentacion,
): ErroresRetroalimentacion {
  const errores: ErroresRetroalimentacion = {};
  if (
    !Number.isInteger(borrador.calificacion) ||
    borrador.calificacion < 1 ||
    borrador.calificacion > 5
  ) {
    errores.calificacion = 'Elige de 1 a 5 estrellas.';
  }
  if (borrador.comentario.trim().length > LARGO_MAX_COMENTARIO) {
    errores.comentario = `Máximo ${LARGO_MAX_COMENTARIO} caracteres.`;
  }
  if (borrador.coincide === null) {
    errores.coincide = 'Indica si la accesibilidad coincidía con lo publicado.';
  }
  if (borrador.coincide === false) {
    if (!borrador.tipoDiscrepancia) {
      errores.tipoDiscrepancia = 'Elige qué no coincidía.';
    }
    const largo = borrador.descripcionDiscrepancia.trim().length;
    if (largo < LARGO_MIN_DESCRIPCION || largo > LARGO_MAX_COMENTARIO) {
      errores.descripcionDiscrepancia = `Describe lo que encontraste (mínimo ${LARGO_MIN_DESCRIPCION} caracteres).`;
    }
  }
  return errores;
}

export function esBorradorValido(borrador: BorradorRetroalimentacion): boolean {
  return Object.keys(validarBorradorRetro(borrador)).length === 0;
}

/** ¿Este envío abrirá una incidencia para moderación? (para avisar en la UI). */
export function abriraIncidencia(borrador: BorradorRetroalimentacion): boolean {
  return (
    borrador.coincide === false ||
    (borrador.calificacion >= 1 &&
      borrador.calificacion <= CALIFICACION_ESCALAMIENTO)
  );
}

/** Cuerpo de `POST /retroalimentacion`. */
export interface CuerpoRetroalimentacion {
  poiId: number;
  calificacion: number;
  comentario: string;
  coincide: boolean;
  tipoDiscrepancia?: TipoDiscrepancia;
  descripcionDiscrepancia?: string;
}

export function construirCuerpoRetro(
  poiId: string,
  borrador: BorradorRetroalimentacion,
): CuerpoRetroalimentacion {
  const cuerpo: CuerpoRetroalimentacion = {
    poiId: Number(poiId),
    calificacion: borrador.calificacion,
    comentario: borrador.comentario.trim(),
    coincide: borrador.coincide !== false,
  };
  if (borrador.coincide === false && borrador.tipoDiscrepancia) {
    cuerpo.tipoDiscrepancia = borrador.tipoDiscrepancia;
    cuerpo.descripcionDiscrepancia = borrador.descripcionDiscrepancia.trim();
  }
  return cuerpo;
}
