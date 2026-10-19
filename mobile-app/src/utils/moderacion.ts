import type { IconName, ValorCaracteristicaReporte } from '../services/types';
import { claveDeTexto } from '../services/mocks/fotosPoi';
import { colors } from './theme';

/**
 * Dimensión de accesibilidad de un reporte (chips de M03). OmniTravel cubre
 * discapacidad motriz y sensorial; lo que no encaja queda en «Otra».
 */
export type Dimension = 'Motriz' | 'Sensorial' | 'Otra';

const SENSORIAL = /(sonoro|podotactil|braille|senal|visual|auditiv|tactil)/;

/** Clasifica un reporte por las características que propone. */
export function dimensionDeReporte(
  valores: Pick<ValorCaracteristicaReporte, 'nombre'>[],
): Dimension {
  const nombres = valores.map((valor) => claveDeTexto(valor.nombre));
  if (nombres.some((nombre) => SENSORIAL.test(nombre))) {
    return 'Sensorial';
  }
  return nombres.length > 0 ? 'Motriz' : 'Otra';
}

export const ICONO_DIMENSION: Record<Dimension, IconName> = {
  Motriz: 'accessibility',
  Sensorial: 'eye-outline',
  Otra: 'ellipsis-horizontal',
};

/** Tipo visible del reporte (U09): barrera crítica u oferta accesible. */
export function tipoDeReporte(esCritico: boolean): {
  texto: string;
  icono: IconName;
  color: string;
} {
  return esCritico
    ? { texto: 'Barrera / Obstáculo', icono: 'warning', color: colors.warning }
    : {
        texto: 'Lugar Accesible',
        icono: 'checkmark-circle',
        color: colors.success,
      };
}

/** «17 sep. 2025, 10:24 a. m.» (formato de M03/M04). */
export function fechaHoraCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  return fecha.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** «Hace 2 horas», «Ayer», «15 sep.» para actividad reciente y notificaciones. */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const fecha = new Date(iso).getTime();
  if (Number.isNaN(fecha)) {
    return '';
  }
  const minutos = Math.max(0, Math.round((ahora - fecha) / 60000));
  if (minutos < 1) {
    return 'Ahora';
  }
  if (minutos < 60) {
    return `Hace ${minutos} min`;
  }
  const horas = Math.round(minutos / 60);
  if (horas < 24) {
    return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }
  const dias = Math.round(horas / 24);
  if (dias === 1) {
    return 'Ayer';
  }
  if (dias < 7) {
    return `Hace ${dias} días`;
  }
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
