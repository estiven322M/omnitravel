import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../services/types';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';
import { AppButton } from './AppButton';

interface Props {
  icono: IconName;
  titulo: string;
  descripcion: string;
  textoBoton?: string;
  onPressBoton?: () => void;
}

/** Estado vacío / "próximamente" reutilizable para pantallas en construcción. */
export function EmptyState({
  icono,
  titulo,
  descripcion,
  textoBoton,
  onPressBoton,
}: Props) {
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.icono}>
        <Ionicons name={icono} size={40} color={colors.primary} />
      </View>
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilos.descripcion}>{descripcion}</Text>
      {textoBoton && onPressBoton ? (
        <AppButton
          titulo={textoBoton}
          onPress={onPressBoton}
          variante="contorno"
          estilo={estilos.boton}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  icono: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  titulo: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  descripcion: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  boton: {
    marginTop: spacing.md,
  },
});
