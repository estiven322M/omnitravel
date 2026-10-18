import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../components/EmptyState';
import type { MainTabParamList } from '../navigation/types';
import { useProfileStore } from '../store/profileStore';
import { colors, fontSize, fontWeight, spacing } from '../utils/theme';

/**
 * Inicio (U04 en los mockups). El feed completo de lugares llega en la
 * siguiente iteración; por ahora da la bienvenida y enruta al mapa.
 */
export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const nombre = useProfileStore((estado) => estado.perfil?.nombre);

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.encabezado}>
        <Text style={estilos.saludo}>
          ¡Hola, {nombre?.split(' ')[0] ?? 'viajero'}!
        </Text>
        <Text style={estilos.pregunta}>¿Qué lugar quieres descubrir hoy?</Text>
      </View>
      <EmptyState
        icono="compass-outline"
        titulo="Feed de lugares accesibles"
        descripcion="El listado de lugares verificados cerca de ti (U04) llega en la siguiente iteración. Mientras tanto, explora el mapa interactivo."
        textoBoton="Ir al mapa"
        onPressBoton={() => navigation.navigate('Mapa')}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  encabezado: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  saludo: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  pregunta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
