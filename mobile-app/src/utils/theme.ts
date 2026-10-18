/**
 * Tokens de diseño de OmniTravel.
 *
 * Paleta extraída de los mockups oficiales (docs/4. OmniTravel UI_ Mockups.pdf)
 * y verificada para contraste WCAG 2.1 AA (RNF-11).
 */

export const colors = {
  /** Azul primario (botones, enlaces, tab activo). Contraste 6.9:1 sobre blanco. */
  primary: '#0455BE',
  primaryDark: '#033E8C',
  /** Fondo azul claro para chips y tarjetas informativas. */
  primarySoft: '#EEF5FC',
  /** Verde de verificación/accesibilidad confirmada. */
  success: '#0E7F43',
  successSoft: '#EAF5EE',
  /** Naranja de advertencia (barreras). Usar para iconos, no para texto pequeño. */
  warning: '#F57B15',
  warningSoft: '#FEF2E2',
  /** Rojo de rechazo/peligro. */
  danger: '#D2282A',
  dangerSoft: '#FCEBEB',
  /** Texto principal (títulos). */
  textPrimary: '#101828',
  /** Texto secundario (cumple AA sobre blanco). */
  textSecondary: '#6E7377',
  /** Gris claro: solo decorativo, no usar para texto legible (no cumple AA). */
  textMuted: '#9AA1A9',
  background: '#FFFFFF',
  surface: '#F7F9FB',
  border: '#E5E8EB',
  white: '#FFFFFF',
  overlay: 'rgba(16, 24, 40, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Área táctil mínima recomendada (RNF-12, WCAG 2.5.5). */
export const TOUCH_TARGET = 44;

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
