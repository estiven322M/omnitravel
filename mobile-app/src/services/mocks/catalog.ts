import type { CaracteristicaAccesibilidad } from '../types';

/**
 * Catálogo de características de accesibilidad.
 *
 * Espejo de la tabla CARACTERISTICA_ACCESIBILIDAD (catálogo controlado, no EAV
 * libre). Carga inicial definida en el modelo físico (Paso 6 del diseño de BD).
 * El catálogo es extensible sin modificar los formularios ni los filtros.
 */
export const CATALOGO_CARACTERISTICAS: CaracteristicaAccesibilidad[] = [
  {
    id: 'ancho_puerta',
    nombre: 'Ancho de puerta',
    tipoValor: 'NUMERICO',
    unidad: 'cm',
    icono: 'resize-outline',
  },
  {
    id: 'tiene_rampa',
    nombre: 'Rampa de acceso',
    tipoValor: 'BOOLEANO',
    icono: 'arrow-up-outline',
  },
  {
    id: 'tiene_ascensor',
    nombre: 'Ascensor',
    tipoValor: 'BOOLEANO',
    icono: 'swap-vertical-outline',
  },
  {
    id: 'tiene_escaleras',
    nombre: 'Escaleras',
    tipoValor: 'BOOLEANO',
    icono: 'trending-up-outline',
  },
  {
    id: 'tiene_bano_accesible',
    nombre: 'Baño adaptado',
    tipoValor: 'BOOLEANO',
    icono: 'water-outline',
  },
  {
    id: 'tiene_semaforo_sonoro',
    nombre: 'Semáforo sonoro',
    tipoValor: 'BOOLEANO',
    icono: 'volume-high-outline',
  },
  {
    id: 'tiene_piso_podotactil',
    nombre: 'Piso podotáctil',
    tipoValor: 'BOOLEANO',
    icono: 'footsteps-outline',
  },
  {
    id: 'tiene_braille',
    nombre: 'Menú en Braille',
    tipoValor: 'BOOLEANO',
    icono: 'text-outline',
  },
];

export function getCaracteristica(
  id: string,
): CaracteristicaAccesibilidad | undefined {
  return CATALOGO_CARACTERISTICAS.find((c) => c.id === id);
}
