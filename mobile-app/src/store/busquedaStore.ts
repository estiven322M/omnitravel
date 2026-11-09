import { create } from 'zustand';

/**
 * Texto del buscador de Inicio (U04). Vive fuera de la pantalla para que no
 * se pierda al navegar: al volver de una ruta sigue mostrando el lugar que
 * se buscó o el que se visitó, hasta que la persona pulse «Limpiar búsqueda».
 */
interface EstadoBusqueda {
  texto: string;
  establecer: (texto: string) => void;
}

export const useBusquedaStore = create<EstadoBusqueda>()((set) => ({
  texto: '',
  establecer: (texto) => set({ texto }),
}));
