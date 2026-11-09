/**
 * Lógica pura de la pestaña «Estadísticas» del moderador: segmentos de la
 * barra de estados, escala de las barras de actividad y etiquetas de días.
 */

export interface Segmento {
  clave: string;
  total: number;
  /** Porcentaje del total (0–100), redondeado a entero. */
  porcentaje: number;
}

/** Segmentos en el orden pedido; los estados sin datos se omiten. */
export function segmentosDe(
  conteos: Record<string, number>,
  orden: string[],
): Segmento[] {
  const total = orden.reduce((suma, clave) => suma + (conteos[clave] ?? 0), 0);
  if (total === 0) {
    return [];
  }
  return orden
    .filter((clave) => (conteos[clave] ?? 0) > 0)
    .map((clave) => ({
      clave,
      total: conteos[clave],
      porcentaje: Math.round((conteos[clave] / total) * 100),
    }));
}

/** Máximo «redondo» para el eje de las barras (1, 2, 5, 10, 20, 50…). */
export function maximoRedondo(valores: number[]): number {
  const maximo = Math.max(1, ...valores);
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const factor of [1, 2, 5, 10]) {
    if (maximo <= factor * potencia) {
      return factor * potencia;
    }
  }
  return 10 * potencia;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** «2026-11-08» → «dom 8» (sin depender de la zona horaria del teléfono). */
export function etiquetaDia(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS[fecha.getUTCDay()]} ${dia}`;
}

/** Variación del mes actual frente al anterior, en porcentaje entero. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) {
    return null;
  }
  return Math.round(((actual - anterior) / anterior) * 100);
}
