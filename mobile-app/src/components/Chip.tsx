import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../services/types';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

interface Props {
  etiqueta: string;
  seleccionado?: boolean;
  onPress?: () => void;
  icono?: IconName;
}

/**
 * Pill de OmniTravel. Si recibe `onPress` se comporta como casilla de filtro
 * (accesible con estado marcado/desmarcado); si no, es una etiqueta estática.
 */
export function Chip({
  etiqueta,
  seleccionado = false,
  onPress,
  icono,
}: Props) {
  const contenido = (
    <>
      {icono ? (
        <Ionicons
          name={icono}
          size={14}
          color={seleccionado ? colors.white : colors.primary}
        />
      ) : null}
      <Text
        style={[estilos.texto, seleccionado ? estilos.textoSeleccionado : null]}
      >
        {etiqueta}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={[estilos.base, estilos.estatico]}>{contenido}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="checkbox"
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked: seleccionado }}
      style={({ pressed }) => [
        estilos.base,
        seleccionado ? estilos.seleccionado : estilos.noSeleccionado,
        pressed ? estilos.presionado : null,
      ]}
    >
      {contenido}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 32,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  estatico: {
    backgroundColor: colors.primarySoft,
  },
  noSeleccionado: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seleccionado: {
    backgroundColor: colors.primary,
  },
  presionado: {
    opacity: 0.85,
  },
  texto: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  textoSeleccionado: {
    color: colors.white,
  },
});
