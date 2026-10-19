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

type Variante = 'primario' | 'contorno' | 'peligro' | 'fantasma' | 'exito';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  deshabilitado?: boolean;
  cargando?: boolean;
  icono?: IconName;
  /** Icono después del texto (p. ej. la flecha de «Comenzar →» en U01/U02). */
  iconoFinal?: IconName;
  /** 'pastilla' (por defecto) o 'redondeado' (botones de U08, M04, M05). */
  forma?: 'pastilla' | 'redondeado';
  /** Texto de 14 px para barras con dos botones (M04, M05). */
  compacto?: boolean;
  pistaAccesibilidad?: string;
  estilo?: ViewStyle;
}

const COLOR_TEXTO: Record<Variante, string> = {
  primario: colors.white,
  contorno: colors.primary,
  peligro: colors.white,
  fantasma: colors.primary,
  exito: colors.white,
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
  iconoFinal,
  forma = 'pastilla',
  compacto = false,
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
      accessibilityLabel={titulo.replace(/\n/g, ' ')}
      accessibilityHint={pistaAccesibilidad}
      accessibilityState={{ disabled: deshabilitado, busy: cargando }}
      style={({ pressed }) => [
        estilos.base,
        forma === 'redondeado' ? estilos.redondeado : null,
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
          <Text
            style={[
              estilos.texto,
              compacto ? estilos.textoCompacto : null,
              { color: colorTexto },
            ]}
          >
            {titulo}
          </Text>
          {iconoFinal ? (
            <Ionicons name={iconoFinal} size={20} color={colorTexto} />
          ) : null}
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
  redondeado: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  primario: {
    backgroundColor: colors.primary,
  },
  exito: {
    backgroundColor: '#11795A',
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
  textoCompacto: {
    fontSize: 13,
  },
  texto: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    flexShrink: 1,
  },
});
