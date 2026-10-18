import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radii, shadow, spacing } from '../utils/theme';

interface Props {
  estilo?: ViewStyle;
}

/** Tarjeta blanca redondeada, base visual de toda la app. */
export function Card({ children, estilo }: PropsWithChildren<Props>) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
});
