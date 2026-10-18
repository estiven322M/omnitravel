import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FiltroId } from '../utils/filters';

/**
 * Perfil de accesibilidad local.
 *
 * Privacidad por diseño (ADR-09, Ley 1581): las preferencias de accesibilidad
 * viven EXCLUSIVAMENTE en el almacenamiento cifrado del dispositivo
 * (Keychain en iOS / Keystore en Android vía expo-secure-store) y nunca se
 * envían al backend (RNF-07 / RNF-08).
 */

export type NecesidadAccesibilidad =
  'movilidad_reducida' | 'silla_de_ruedas' | 'visual';

export interface PerfilAccesibilidad {
  nombre: string;
  necesidades: NecesidadAccesibilidad[];
  filtrosActivos: FiltroId[];
  creadoEn: string;
}

interface EstadoPerfil {
  /** true cuando el store terminó de leer el almacenamiento seguro. */
  hidratado: boolean;
  perfil: PerfilAccesibilidad | null;
  guardarPerfil: (perfil: Omit<PerfilAccesibilidad, 'creadoEn'>) => void;
  alternarFiltro: (filtro: FiltroId) => void;
  establecerFiltros: (filtros: FiltroId[]) => void;
  cerrarSesion: () => void;
}

const almacenamientoSeguro = {
  getItem: (nombre: string) => SecureStore.getItemAsync(nombre),
  setItem: (nombre: string, valor: string) =>
    SecureStore.setItemAsync(nombre, valor),
  removeItem: (nombre: string) => SecureStore.deleteItemAsync(nombre),
};

export const useProfileStore = create<EstadoPerfil>()(
  persist(
    (set) => ({
      hidratado: false,
      perfil: null,
      guardarPerfil: (datos) =>
        set({
          perfil: { ...datos, creadoEn: new Date().toISOString() },
        }),
      alternarFiltro: (filtro) =>
        set((estado) => {
          if (!estado.perfil) {
            return estado;
          }
          const activos = estado.perfil.filtrosActivos.includes(filtro)
            ? estado.perfil.filtrosActivos.filter((f) => f !== filtro)
            : [...estado.perfil.filtrosActivos, filtro];
          return {
            perfil: { ...estado.perfil, filtrosActivos: activos },
          };
        }),
      establecerFiltros: (filtros) =>
        set((estado) =>
          estado.perfil
            ? { perfil: { ...estado.perfil, filtrosActivos: filtros } }
            : estado,
        ),
      cerrarSesion: () => set({ perfil: null }),
    }),
    {
      name: 'omnitravel-perfil',
      storage: createJSONStorage(() => almacenamientoSeguro),
      partialize: (estado) => ({ perfil: estado.perfil }),
      onRehydrateStorage: () => () => {
        // Marca la hidratación incluso si el almacenamiento falla:
        // en el peor caso la app arranca en la pantalla de registro.
        useProfileStore.setState({ hidratado: true });
      },
    },
  ),
);
