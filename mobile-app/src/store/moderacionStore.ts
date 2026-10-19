import { create } from 'zustand';
import type { ReporteModeracion } from '../services/types';

/**
 * Reporte abierto en la revisión (M04). La lista (M03) lo deja aquí antes de
 * navegar para no volver a pedirlo al backend; tras decidir, `version` sube
 * y la lista y el tablero se recargan.
 */
interface EstadoModeracion {
  seleccionado: ReporteModeracion | null;
  version: number;
  seleccionar: (reporte: ReporteModeracion | null) => void;
  marcarCambio: () => void;
}

export const useModeracionStore = create<EstadoModeracion>((set) => ({
  seleccionado: null,
  version: 0,
  seleccionar: (reporte) => set({ seleccionado: reporte }),
  marcarCambio: () => set((estado) => ({ version: estado.version + 1 })),
}));
