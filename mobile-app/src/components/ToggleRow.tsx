import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { IconName } from '../services/types';
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
  /** Icono de la izquierda (mockup U05). */
  icono?: IconName;
}

/**
 * Fila con interruptor (filtros U05). Toda la fila es táctil (≥ 44 px) y se
 * anuncia como "switch" con su estado a TalkBack / VoiceOver (RNF-12).
 */
export function ToggleRow({
  etiqueta,
  descripcion,
  valor,
  onCambio,
  icono,
}: Props) {
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
      {icono ? <Ionicons name={icono} size={26} color={colors.navy} /> : null}
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
        trackColor={{ false: '#C9D1DC', true: colors.primary }}
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
    color: colors.navy,
  },
  descripcion: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    marginTop: 2,
  },
});
