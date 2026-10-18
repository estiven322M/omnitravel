import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../services/types';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

export type TonoBadge = 'exito' | 'alerta' | 'peligro' | 'neutro';

interface Props {
  texto: string;
  tono?: TonoBadge;
  icono?: IconName;
}

const ESTILOS_TONO: Record<
  TonoBadge,
  { fondo: string; texto: string; icono: string }
> = {
  exito: {
    fondo: colors.successSoft,
    texto: colors.success,
    icono: 'shield-checkmark',
  },
  alerta: { fondo: colors.warningSoft, texto: colors.warning, icono: 'time' },
  peligro: {
    fondo: colors.dangerSoft,
    texto: colors.danger,
    icono: 'alert-circle',
  },
  neutro: {
    fondo: colors.surface,
    texto: colors.textSecondary,
    icono: 'information-circle',
  },
};

/** Etiqueta de estado (verificado, en revisión, pendiente…). */
export function Badge({ texto, tono = 'neutro', icono }: Props) {
  const paleta = ESTILOS_TONO[tono];
  const nombreIcono = icono ?? paleta.icono;

  return (
    <View style={[estilos.base, { backgroundColor: paleta.fondo }]}>
      <Ionicons name={nombreIcono as IconName} size={14} color={paleta.texto} />
      <Text style={[estilos.texto, { color: paleta.texto }]}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  texto: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
