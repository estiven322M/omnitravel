import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '../utils/theme';

interface Props {
  tamano?: number;
  mostrarTagline?: boolean;
}

/**
 * Marca de OmniTravel: pin azul con símbolo de accesibilidad + nombre.
 * Reemplaza al logo oficial mientras se integra el asset definitivo.
 */
export function BrandMark({ tamano = 64, mostrarTagline = true }: Props) {
  return (
    <View
      style={estilos.contenedor}
      accessible
      accessibilityRole="image"
      accessibilityLabel="OmniTravel, tu mundo sin barreras"
    >
      <View
        style={[
          estilos.logo,
          { width: tamano, height: tamano, borderRadius: tamano / 2 },
        ]}
      >
        <Ionicons
          name="accessibility"
          size={tamano * 0.55}
          color={colors.white}
        />
      </View>
      <Text style={estilos.nombre}>OmniTravel</Text>
      {mostrarTagline ? (
        <Text style={estilos.tagline}>Tu mundo, sin barreras</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
