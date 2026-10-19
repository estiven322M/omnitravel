import type { IconName } from '../services/types';

/**
 * Icono de la categoría de un lugar (mockups U04/U06). Las categorías nacen
 * del campo `tipo` de la BD, así que el mapa cubre las conocidas y degrada a
 * un pin genérico para categorías nuevas.
 */
const ICONO_POR_CATEGORIA: Record<string, IconName> = {
  Museo: 'business-outline',
  Parque: 'leaf-outline',
  Restaurante: 'restaurant-outline',
  Hotel: 'bed-outline',
  'Centro cultural': 'color-palette-outline',
  Biblioteca: 'book-outline',
  Transporte: 'bus-outline',
  Atraccion: 'camera-outline',
  Atracción: 'camera-outline',
  Mirador: 'camera-outline',
};

/** Nombre plural con tildes para los chips de U04/U06 («Restaurantes»…). */
const PLURAL_POR_CATEGORIA: Record<string, string> = {
  Museo: 'Museos',
  Parque: 'Parques',
  Restaurante: 'Restaurantes',
  Hotel: 'Hoteles',
  'Centro cultural': 'Centros culturales',
  Biblioteca: 'Bibliotecas',
  Transporte: 'Transporte',
  Atraccion: 'Atracciones',
  Atracción: 'Atracciones',
  Mirador: 'Miradores',
};

export function etiquetaDeCategoria(categoria: string): string {
  return PLURAL_POR_CATEGORIA[categoria] ?? categoria;
}

export function iconoDeCategoria(categoria: string): IconName {
  return ICONO_POR_CATEGORIA[categoria] ?? 'location-outline';
}
