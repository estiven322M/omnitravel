import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type {
  CaracteristicaAccesibilidad,
  ValorAccesibilidad,
} from '../services/types';
import { formatearValorCaracteristica } from '../utils/format';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

interface Props {
  caracteristica: CaracteristicaAccesibilidad;
  valor?: ValorAccesibilidad;
}

/**
 * Fila de la ficha de accesibilidad (U08). Renderiza el valor según el
 * `tipoValor` del catálogo: booleano → ✓/✗, numérico → "90 cm", texto → texto.
 */
export function AccessibilityValueRow({ caracteristica, valor }: Props) {
  const textoValor = formatearValorCaracteristica(caracteristica, valor);
  const esBooleano = caracteristica.tipoValor === 'BOOLEANO';
  const booleanoVerdadero = valor?.valorBooleano === true;
  const sinInformacion = textoValor === 'Sin información';

  const colorValor = sinInformacion
    ? colors.textSecondary
    : esBooleano
      ? booleanoVerdadero
        ? colors.success
        : colors.danger
      : colors.textPrimary;

  const iconoValor = sinInformacion
    ? 'help-circle-outline'
    : esBooleano
      ? booleanoVerdadero
        ? 'checkmark-circle'
        : 'close-circle'
      : undefined;

  return (
    <View
      style={estilos.fila}
      accessible
      accessibilityLabel={`${caracteristica.nombre}: ${textoValor}`}
    >
      <View style={estilos.icono}>
        <Ionicons
          name={caracteristica.icono}
          size={18}
          color={colors.primary}
        />
      </View>
      <Text style={estilos.nombre}>{caracteristica.nombre}</Text>
      <View style={estilos.valorContenedor}>
        {iconoValor ? (
          <Ionicons name={iconoValor} size={16} color={colorValor} />
        ) : null}
        <Text style={[estilos.valor, { color: colorValor }]}>{textoValor}</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  icono: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  valorContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  valor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
