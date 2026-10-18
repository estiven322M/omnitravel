import type {
  CaracteristicaAccesibilidad,
  ValorAccesibilidad,
} from '../services/types';

/**
 * Convierte el valor de una característica de accesibilidad en texto legible.
 * El formato depende del tipo de valor del catálogo (BOOLEANO/NUMERICO/TEXTO),
 * tal como lo define el modelo de datos (VALOR_ACCESIBILIDAD_POI).
 */
export function formatearValorCaracteristica(
  caracteristica: CaracteristicaAccesibilidad,
  valor?: ValorAccesibilidad,
): string {
  if (!valor) {
    return 'Sin información';
  }

  switch (caracteristica.tipoValor) {
    case 'BOOLEANO':
      if (valor.valorBooleano === undefined) {
        return 'Sin información';
      }
      return valor.valorBooleano ? 'Sí' : 'No';
    case 'NUMERICO':
      if (valor.valorNumerico === undefined) {
        return 'Sin información';
      }
      return caracteristica.unidad
        ? `${valor.valorNumerico} ${caracteristica.unidad}`
        : String(valor.valorNumerico);
    case 'TEXTO':
      return valor.valorTexto ?? 'Sin información';
  }
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Formatea una fecha ISO a "12 de agosto de 2025".
 * Se implementa sin Intl para garantizar compatibilidad total con Hermes.
 */
export function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha desconocida';
  }
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/** Formatea una distancia en km a "850 m" o "1.2 km". */
export function formatearDistancia(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}
