import * as SecureStore from '../services/almacenamiento';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RolUsuario } from '../services/types';
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
  /**
   * Rol de dominio derivado de la fila `usuario` al iniciar sesión
   * (moderador/administrador habilitan la consola M03–M05). Perfiles
   * antiguos sin este campo se leen como 'viajero'.
   */
  rol: RolUsuario;
  /**
   * Identificador de la cuenta dueña de este perfil (id de la fila
   * `usuario`, con respaldo en el UUID de Supabase Auth). La foto de
   * perfil vive POR CUENTA en el dispositivo: este id elige su archivo.
   */
  idCuenta?: string;
  /**
   * Foto del usuario elegida desde la galería: se copia al almacenamiento
   * privado de la app y NUNCA sale del dispositivo (Ley 1581).
   */
  fotoUri?: string;
  /**
   * Cómo entró la persona en el login: «viajero» abre la vista de usuario y
   * «moderacion» el panel de moderación (solo si su rol de la BD lo permite).
   */
  modo?: ModoIngreso;
}

export type ModoIngreso = 'viajero' | 'moderacion';

interface EstadoPerfil {
  /** true cuando el store terminó de leer el almacenamiento seguro. */
  hidratado: boolean;
  perfil: PerfilAccesibilidad | null;
  /**
   * Correo del último inicio de sesión: permite "entrar la próxima vez sin
   * registrarse" incluso después de cerrar sesión. Se conserva cifrado y se
   * olvida solo si la persona lo pide.
   */
  ultimoEmail?: string;
  guardarPerfil: (perfil: DatosPerfil) => void;
  recordarEmail: (email: string) => void;
  olvidarEmail: () => void;
  establecerFoto: (fotoUri?: string) => void;
  alternarFiltro: (filtro: FiltroId) => void;
  establecerFiltros: (filtros: FiltroId[]) => void;
  cerrarSesion: () => void;
}

/**
 * Datos aceptados por `guardarPerfil`: el rol es opcional y se degrada a
 * 'viajero' (mínimo privilegio) cuando el llamador no lo conoce.
 */
export type DatosPerfil = Omit<PerfilAccesibilidad, 'creadoEn' | 'rol'> & {
  rol?: RolUsuario;
};

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
      ultimoEmail: undefined,
      guardarPerfil: (datos) =>
        set((estado) => ({
          perfil: {
            ...datos,
            rol: datos.rol ?? 'viajero',
            creadoEn: new Date().toISOString(),
            // La foto sobrevive únicamente entre sesiones de LA MISMA
            // cuenta: al entrar con otro usuario no se hereda la foto
            // anterior (cada cuenta tiene su archivo en el dispositivo).
            fotoUri:
              datos.idCuenta !== undefined &&
              estado.perfil?.idCuenta === datos.idCuenta
                ? (datos.fotoUri ?? estado.perfil?.fotoUri)
                : datos.fotoUri,
          },
        })),
      recordarEmail: (email) =>
        set({ ultimoEmail: email.trim().toLowerCase() }),
      olvidarEmail: () => set({ ultimoEmail: undefined }),
      establecerFoto: (fotoUri) =>
        set((estado) =>
          estado.perfil ? { perfil: { ...estado.perfil, fotoUri } } : estado,
        ),
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
      partialize: (estado) => ({
        perfil: estado.perfil,
        ultimoEmail: estado.ultimoEmail,
      }),
      onRehydrateStorage: () => () => {
        // Marca la hidratación incluso si el almacenamiento falla:
        // en el peor caso la app arranca en la pantalla de registro.
        useProfileStore.setState({ hidratado: true });
      },
    },
  ),
);
