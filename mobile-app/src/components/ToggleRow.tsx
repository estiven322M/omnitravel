import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

interface Props {
  etiqueta: string;
  descripcion?: string;
  valor: boolean;
  onCambio: (valor: boolean) => void;
}

/**
 * Fila con interruptor (filtros U05). Toda la fila es táctil (≥ 44 px) y se
 * anuncia como "switch" con su estado a TalkBack / VoiceOver (RNF-12).
 */
export function ToggleRow({ etiqueta, descripcion, valor, onCambio }: Props) {
  return (
    <Pressable
      onPress={() => onCambio(!valor)}
      accessibilityRole="switch"
      accessibilityLabel={etiqueta}
      accessibilityHint={descripcion}
      accessibilityState={{ checked: valor }}
      style={({ pressed }) => [
        estilos.fila,
        pressed ? estilos.presionado : null,
      ]}
    >
      <View style={estilos.textos}>
        <Text style={estilos.etiqueta}>{etiqueta}</Text>
        {descripcion ? (
          <Text style={estilos.descripcion}>{descripcion}</Text>
        ) : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambio}
        accessible={false}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  presionado: {
    opacity: 0.85,
  },
  textos: {
    flex: 1,
  },
  etiqueta: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  descripcion: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
