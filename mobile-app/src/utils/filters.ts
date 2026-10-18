import type { Poi } from '../services/types';

/**
 * Filtros de accesibilidad de la pantalla U05.
 * Cada filtro referencia una característica del catálogo
 * (CARACTERISTICA_ACCESIBILIDAD) y una condición sobre su valor.
 */

export type GrupoFiltro = 'motriz' | 'sensorial';

export type FiltroId =
  | 'ancho_puerta_80'
  | 'sin_escalones'
  | 'ascensor_amplio'
  | 'semaforos_sonoros'
  | 'menu_braille'
  | 'piso_podotactil';

export interface DefinicionFiltro {
  id: FiltroId;
  grupo: GrupoFiltro;
  etiqueta: string;
  caracteristicaId: string;
  tipo: 'booleano_true' | 'booleano_false' | 'numerico_min';
  valor?: number;
}

export const FILTROS: DefinicionFiltro[] = [
  {
    id: 'ancho_puerta_80',
    grupo: 'motriz',
    etiqueta: 'Ancho de puerta > 80 cm',
    caracteristicaId: 'ancho_puerta',
    tipo: 'numerico_min',
    valor: 80,
  },
  {
    id: 'sin_escalones',
    grupo: 'motriz',
    etiqueta: 'Sin escalones absolutos',
    caracteristicaId: 'tiene_escaleras',
    tipo: 'booleano_false',
  },
  {
    id: 'ascensor_amplio',
    grupo: 'motriz',
    etiqueta: 'Ascensor amplio',
    caracteristicaId: 'tiene_ascensor',
    tipo: 'booleano_true',
  },
  {
    id: 'semaforos_sonoros',
    grupo: 'sensorial',
    etiqueta: 'Semáforos sonoros',
    caracteristicaId: 'tiene_semaforo_sonoro',
    tipo: 'booleano_true',
  },
  {
    id: 'menu_braille',
    grupo: 'sensorial',
    etiqueta: 'Menú en Braille',
    caracteristicaId: 'tiene_braille',
    tipo: 'booleano_true',
  },
  {
    id: 'piso_podotactil',
    grupo: 'sensorial',
    etiqueta: 'Piso podotáctil',
    caracteristicaId: 'tiene_piso_podotactil',
    tipo: 'booleano_true',
  },
];

export function poiCumpleFiltro(poi: Poi, filtro: DefinicionFiltro): boolean {
  const valor = poi.valores.find(
    (v) => v.caracteristicaId === filtro.caracteristicaId,
  );

  // Si el POI no tiene dato para la característica, no puede garantizar el filtro.
  if (!valor) {
    return false;
  }

  switch (filtro.tipo) {
    case 'booleano_true':
      return valor.valorBooleano === true;
    case 'booleano_false':
      return valor.valorBooleano === false;
    case 'numerico_min':
      return (
        valor.valorNumerico !== undefined &&
        valor.valorNumerico >= (filtro.valor ?? 0)
      );
  }
}

export function aplicarFiltros(pois: Poi[], filtrosActivos: FiltroId[]): Poi[] {
  if (filtrosActivos.length === 0) {
    return pois;
  }

  const definiciones = FILTROS.filter((f) => filtrosActivos.includes(f.id));
  return pois.filter((poi) =>
    definiciones.every((filtro) => poiCumpleFiltro(poi, filtro)),
  );
}
