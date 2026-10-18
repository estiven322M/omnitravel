import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import type { IconName } from '../services/types';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

type Variante = 'primario' | 'contorno' | 'peligro' | 'fantasma';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  deshabilitado?: boolean;
  cargando?: boolean;
  icono?: IconName;
  pistaAccesibilidad?: string;
  estilo?: ViewStyle;
}

const COLOR_TEXTO: Record<Variante, string> = {
  primario: colors.white,
  contorno: colors.primary,
  peligro: colors.white,
  fantasma: colors.primary,
};

/**
 * Botón base de OmniTravel.
 * - Área táctil ≥ 48 px y estados anunciados a lectores de pantalla (RNF-12).
 */
export function AppButton({
  titulo,
  onPress,
  variante = 'primario',
  deshabilitado = false,
  cargando = false,
  icono,
  pistaAccesibilidad,
  estilo,
}: Props) {
  const inactivo = deshabilitado || cargando;
  const colorTexto = COLOR_TEXTO[variante];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={pistaAccesibilidad}
      accessibilityState={{ disabled: deshabilitado, busy: cargando }}
      style={({ pressed }) => [
        estilos.base,
        estilos[variante],
        pressed && !inactivo ? estilos.presionado : null,
        inactivo ? estilos.inactivo : null,
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <>
          {icono ? (
            <Ionicons name={icono} size={18} color={colorTexto} />
          ) : null}
          <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primario: {
    backgroundColor: colors.primary,
  },
  contorno: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  peligro: {
    backgroundColor: colors.danger,
  },
  fantasma: {
    backgroundColor: 'transparent',
  },
  presionado: {
    opacity: 0.85,
  },
  inactivo: {
    opacity: 0.5,
  },
  texto: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
