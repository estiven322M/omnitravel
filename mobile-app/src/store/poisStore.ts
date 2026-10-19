import { create } from 'zustand';
import { cargarDatosMapa, type FuenteDatos } from '../services/pois';
import { CATALOGO_CARACTERISTICAS } from '../services/mocks/catalog';
import type { CaracteristicaAccesibilidad, Poi } from '../services/types';

/**
 * Estado de POIs del mapa (U06/U08).
 *
 * Carga desde el backend (`GET /mapa`, PostgreSQL en AWS RDS). Sin datos de
 * demostración: si el backend no responde, `fuente` queda en `sin-conexion`
 * y las pantallas ofrecen «Reintentar». Si una recarga falla después de una
 * carga buena, se conservan los lugares reales ya leídos. No se persiste: los
 * datos de la BD se releen para reflejar el crowdsourcing vigente.
 */
interface EstadoPois {
  /** true cuando la primera carga terminó (con BD o con fallback). */
  cargado: boolean;
  indicadorCarga: boolean;
  fuente: FuenteDatos;
  /** Información no bloqueante para el usuario (p. ej. RLS pendiente). */
  advertencia?: string;
  pois: Poi[];
  catalogo: CaracteristicaAccesibilidad[];
  cargar: () => Promise<void>;
  poiPorId: (id: string) => Poi | undefined;
}

export const usePoisStore = create<EstadoPois>((set, get) => ({
  cargado: false,
  indicadorCarga: false,
  fuente: 'sin-conexion',
  pois: [],
  catalogo: CATALOGO_CARACTERISTICAS,

  cargar: async () => {
    if (get().indicadorCarga) {
      return;
    }
    set({ indicadorCarga: true });
    try {
      const datos = await cargarDatosMapa();
      if (datos.fuente !== 'backend' && get().fuente === 'backend') {
        // Recarga fallida: se mantienen los lugares reales ya cargados.
        set({ advertencia: datos.advertencia });
        return;
      }
      set({
        cargado: true,
        indicadorCarga: false,
        fuente: datos.fuente,
        advertencia: datos.advertencia,
        pois: datos.pois,
        catalogo: datos.catalogo,
      });
    } finally {
      set({ indicadorCarga: false, cargado: true });
    }
  },

  poiPorId: (id) => get().pois.find((poi) => poi.id === id),
}));
