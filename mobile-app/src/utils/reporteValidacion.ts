import type {
  CaracteristicaAccesibilidad,
  ValorPropuestoReporte,
} from '../services/types';

/**
 * Lógica pura del wizard de reporte (U09/U10): validaciones por paso y
 * construcción de los valores de características que viajan a la RPC
 * `crear_reporte`. Separada de la pantalla para poder probarla con Jest.
 */

export type ModoReporte = 'nuevo' | 'actualizacion';

/** Valor en edición de una característica (borrador del formulario). */
export interface ValorBorrador {
  booleano?: boolean;
  numerico?: string;
  texto?: string;
}

/** Estado completo del formulario en edición. */
export interface BorradorReporte {
  modo: ModoReporte;
  poiId: string | null;
  nombre: string;
  tipoPoi: string;
  direccion: string;
  lat: number | null;
  lon: number | null;
  descripcion: string;
  esCritico: boolean;
  valores: Record<string, ValorBorrador>;
}

export const BORRADOR_INICIAL: BorradorReporte = {
  modo: 'nuevo',
  poiId: null,
  nombre: '',
  tipoPoi: '',
  direccion: '',
  lat: null,
  lon: null,
  descripcion: '',
  esCritico: false,
  valores: {},
};

/** Opciones de tipo de lugar ofrecidas por el wizard (valores de la BD). */
export const TIPOS_POI: { valor: string; etiqueta: string }[] = [
  { valor: 'museo', etiqueta: 'Museo' },
  { valor: 'parque', etiqueta: 'Parque' },
  { valor: 'hotel', etiqueta: 'Hotel' },
  { valor: 'restaurante', etiqueta: 'Restaurante' },
  { valor: 'atraccion', etiqueta: 'Atracción' },
];

/**
 * Mensajes de validación por campo. La pantalla muestra cada uno junto a su
 * campo (auditoría 6.8 ítem 6) y, además, el resumen del paso para el lector
 * de pantalla.
 */
export const MENSAJES_VALIDACION = {
  lugar: 'Selecciona el lugar que quieres actualizar.',
  nombre: 'Escribe el nombre del lugar.',
  tipo: 'Elige el tipo de lugar.',
  ubicacion:
    'Captura la ubicación del lugar con el botón de GPS (o escríbela).',
  descripcion: 'Describe brevemente lo que encontraste.',
} as const;

export type CampoValidado = keyof typeof MENSAJES_VALIDACION;

/** Mensaje de error de un campo concreto, o undefined si está bien. */
export function errorDeCampo(
  errores: string[],
  campo: CampoValidado,
): string | undefined {
  return errores.find((error) => error === MENSAJES_VALIDACION[campo]);
}

/** Identificación del lugar (en el wizard reorganizado se exige en Paso 2). */
export function validarPaso1(borrador: BorradorReporte): string[] {
  const errores: string[] = [];

  if (borrador.modo === 'actualizacion') {
    if (!borrador.poiId) {
      errores.push(MENSAJES_VALIDACION.lugar);
    }
    return errores;
  }

  if (!borrador.nombre.trim()) {
    errores.push(MENSAJES_VALIDACION.nombre);
  }
  if (!borrador.tipoPoi) {
    errores.push(MENSAJES_VALIDACION.tipo);
  }
  return errores;
}

/** Paso 2 — ubicación, evidencia y descripción (combinado, retrocompatible). */
export function validarPaso2(borrador: BorradorReporte): string[] {
  return [...validarUbicacion(borrador), ...validarDescripcion(borrador)];
}

/** Requiere coords para lugares nuevos; al actualizar la BD ya las tiene. */
export function validarUbicacion(borrador: BorradorReporte): string[] {
  if (
    borrador.modo === 'nuevo' &&
    (borrador.lat === null || borrador.lon === null)
  ) {
    return [MENSAJES_VALIDACION.ubicacion];
  }
  return [];
}

/** Paso 3 — el aporte necesita una descripción de lo que se encontró. */
export function validarDescripcion(borrador: BorradorReporte): string[] {
  if (!borrador.descripcion.trim()) {
    return [MENSAJES_VALIDACION.descripcion];
  }
  return [];
}

/** Paso 2 completo del wizard reorganizado: identificación + ubicación. */
export function validarPasoUbicacion(borrador: BorradorReporte): string[] {
  return [...validarPaso1(borrador), ...validarUbicacion(borrador)];
}

/** Paso 3 completo del wizard reorganizado: descripción del aporte. */
export function validarPasoDetalles(borrador: BorradorReporte): string[] {
  return validarDescripcion(borrador);
}

/**
 * Etiquetas rápidas del paso Detalles (mockup U10). Cada etiqueta fija el
 * valor de una característica del catálogo; no todas existen en toda BD, así
 * que la pantalla solo muestra las que el catálogo vigente reconoce.
 */
export type TonoEtiqueta = 'peligro' | 'alerta' | 'exito';

export interface EtiquetaRapida {
  id: string;
  etiqueta: string;
  /** Id estable de la característica que la etiqueta fija. */
  caracteristicaId: string;
  tono: TonoEtiqueta;
  booleano?: boolean;
  numerico?: number;
}

export const ETIQUETAS_RAPIDAS: EtiquetaRapida[] = [
  {
    id: 'sin_rampa',
    etiqueta: 'Sin rampa',
    caracteristicaId: 'tiene_rampa',
    tono: 'peligro',
    booleano: false,
  },
  {
    id: 'rampa_bien',
    etiqueta: 'Rampa en buen estado',
    caracteristicaId: 'tiene_rampa',
    tono: 'exito',
    booleano: true,
  },
  {
    id: 'escalones',
    etiqueta: 'Escalones',
    caracteristicaId: 'tiene_escaleras',
    tono: 'peligro',
    booleano: true,
  },
  {
    id: 'sin_escalones',
    etiqueta: 'Sin escalones',
    caracteristicaId: 'tiene_escaleras',
    tono: 'exito',
    booleano: false,
  },
  {
    id: 'ascensor_danado',
    etiqueta: 'Ascensor dañado',
    caracteristicaId: 'tiene_ascensor',
    tono: 'alerta',
    booleano: false,
  },
  {
    id: 'ascensor_operativo',
    etiqueta: 'Ascensor operativo',
    caracteristicaId: 'tiene_ascensor',
    tono: 'exito',
    booleano: true,
  },
  {
    id: 'bano_no',
    etiqueta: 'Baño no adaptado',
    caracteristicaId: 'tiene_bano_accesible',
    tono: 'peligro',
    booleano: false,
  },
  {
    id: 'bano_si',
    etiqueta: 'Baño adaptado',
    caracteristicaId: 'tiene_bano_accesible',
    tono: 'exito',
    booleano: true,
  },
  {
    id: 'puerta_estrecha',
    etiqueta: 'Puerta estrecha < 80 cm',
    caracteristicaId: 'ancho_puerta',
    tono: 'alerta',
    numerico: 75,
  },
  {
    id: 'puerta_amplia',
    etiqueta: 'Puerta amplia (≥ 80 cm)',
    caracteristicaId: 'ancho_puerta',
    tono: 'exito',
    numerico: 100,
  },
  {
    id: 'braille_no',
    etiqueta: 'Sin menú Braille',
    caracteristicaId: 'tiene_braille',
    tono: 'alerta',
    booleano: false,
  },
  {
    id: 'braille_si',
    etiqueta: 'Menú Braille',
    caracteristicaId: 'tiene_braille',
    tono: 'exito',
    booleano: true,
  },
  {
    id: 'podotactil_no',
    etiqueta: 'Señalización deficiente',
    caracteristicaId: 'tiene_piso_podotactil',
    tono: 'alerta',
    booleano: false,
  },
  {
    id: 'podotactil_si',
    etiqueta: 'Piso podotáctil',
    caracteristicaId: 'tiene_piso_podotactil',
    tono: 'exito',
    booleano: true,
  },
  {
    id: 'semaforo_no',
    etiqueta: 'Sin semáforo sonoro',
    caracteristicaId: 'tiene_semaforo_sonoro',
    tono: 'alerta',
    booleano: false,
  },
  {
    id: 'semaforo_si',
    etiqueta: 'Semáforo sonoro',
    caracteristicaId: 'tiene_semaforo_sonoro',
    tono: 'exito',
    booleano: true,
  },
];

/** ¿Está elegida esa etiqueta con los valores actuales del borrador? */
export function estaEtiquetaElegida(
  valores: Record<string, ValorBorrador>,
  etiqueta: EtiquetaRapida,
): boolean {
  const actual = valores[etiqueta.caracteristicaId];
  if (etiqueta.booleano !== undefined) {
    return actual?.booleano === etiqueta.booleano;
  }
  return actual?.numerico === String(etiqueta.numerico);
}

/** Activa/retira una etiqueta sobre los valores del borrador (sin mutar). */
export function alternarEtiquetaRapida(
  valores: Record<string, ValorBorrador>,
  etiqueta: EtiquetaRapida,
): Record<string, ValorBorrador> {
  if (estaEtiquetaElegida(valores, etiqueta)) {
    const copia = { ...valores };
    delete copia[etiqueta.caracteristicaId];
    return copia;
  }
  return {
    ...valores,
    [etiqueta.caracteristicaId]:
      etiqueta.booleano !== undefined
        ? { booleano: etiqueta.booleano }
        : { numerico: String(etiqueta.numerico) },
  };
}

/**
 * Convierte los valores en edición a la lista que espera la RPC. Solo viajan
 * las características respondidas y con id físico conocido (`idBd`); los
 * decimales aceptan coma o punto.
 */
export function construirCaracteristicas(
  catalogo: CaracteristicaAccesibilidad[],
  valores: Record<string, ValorBorrador>,
): ValorPropuestoReporte[] {
  const resultado: ValorPropuestoReporte[] = [];

  for (const caracteristica of catalogo) {
    if (caracteristica.idBd === undefined) {
      continue;
    }
    const borrador = valores[caracteristica.id];
    if (!borrador) {
      continue;
    }

    if (caracteristica.tipoValor === 'BOOLEANO') {
      if (borrador.booleano === undefined) {
        continue;
      }
      resultado.push({
        caracteristicaId: caracteristica.idBd,
        valorBooleano: borrador.booleano,
      });
      continue;
    }

    if (caracteristica.tipoValor === 'NUMERICO') {
      const numero = Number.parseFloat(
        (borrador.numerico ?? '').replace(',', '.'),
      );
      if (Number.isNaN(numero)) {
        continue;
      }
      resultado.push({
        caracteristicaId: caracteristica.idBd,
        valorNumerico: numero,
      });
      continue;
    }

    const texto = (borrador.texto ?? '').trim();
    if (!texto) {
      continue;
    }
    resultado.push({
      caracteristicaId: caracteristica.idBd,
      valorTexto: texto,
    });
  }

  return resultado;
}

/** Número de características respondidas (resumen del paso 3). */
export function contarValoresRespondidos(
  valores: Record<string, ValorBorrador>,
): number {
  return Object.values(valores).filter(
    (valor) =>
      valor.booleano !== undefined ||
      (valor.numerico ?? '').trim() !== '' ||
      (valor.texto ?? '').trim() !== '',
  ).length;
}
