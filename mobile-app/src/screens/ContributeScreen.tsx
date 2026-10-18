import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../components/EmptyState';
import { colors } from '../utils/theme';

/**
 * Contribuir (U09–U10 en los mockups).
 * El flujo de reportes colaborativos llega en la siguiente iteración.
 */
export function ContributeScreen() {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <EmptyState
        icono="megaphone-outline"
        titulo="Crear reporte"
        descripcion="El flujo de reportes colaborativos con fotos y ubicación (U09–U10) llega en la siguiente iteración."
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
