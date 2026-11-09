import { create } from 'zustand';
import {
  cargarFavoritos,
  guardarFavorito,
  quitarFavorito,
} from '../services/favoritos';

/**
 * Estado de los lugares guardados (tab Guardados + corazón en U06/U08).
 *
 * Carga perezosa al abrir el tab o el detalle; `alternar` es optimista
 * (icono instantáneo) con rollback si la BD rechaza la operación, para que
 * el corazón nunca mienta (RNF-12: errores visibles y objetivo).
 */
interface EstadoFavoritos {
  /** true cuando la primera lectura terminó (con datos o error). */
  cargado: boolean;
  ids: string[];
  error?: string;
  cargando: boolean;
  cargar: () => Promise<void>;
  alternar: (idPoi: string) => Promise<'agregado' | 'quitado'>;
  esFavorito: (idPoi: string) => boolean;
  /** Vacía la lista al cerrar sesión (no se hereda entre cuentas). */
  reiniciar: () => void;
}

export const useFavoritosStore = create<EstadoFavoritos>((set, get) => ({
  cargado: false,
  ids: [],
  cargando: false,

  cargar: async () => {
    if (get().cargando) {
      return;
    }
    set({ cargando: true });
    try {
      const ids = await cargarFavoritos();
      set({ cargado: true, cargando: false, ids, error: undefined });
    } catch (error) {
      set({
        cargado: true,
        cargando: false,
        error: (error as Error).message,
      });
    }
  },

  alternar: async (idPoi) => {
    const yaEstaba = get().ids.includes(idPoi);
    set((estado) => ({
      ids: yaEstaba
        ? estado.ids.filter((id) => id !== idPoi)
        : [idPoi, ...estado.ids],
      error: undefined,
    }));

    try {
      if (yaEstaba) {
        await quitarFavorito(idPoi);
      } else {
        await guardarFavorito(idPoi);
      }
    } catch (error) {
      // Rollback del estado optimista: la BD es la verdad.
      set((estado) => ({
        ids: yaEstaba
          ? [idPoi, ...estado.ids]
          : estado.ids.filter((id) => id !== idPoi),
        error: (error as Error).message,
      }));
      throw error;
    }
    return yaEstaba ? 'quitado' : 'agregado';
  },

  esFavorito: (idPoi) => get().ids.includes(idPoi),

  reiniciar: () =>
    set({ cargado: false, cargando: false, ids: [], error: undefined }),
}));
