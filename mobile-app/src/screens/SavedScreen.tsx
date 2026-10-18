import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../components/EmptyState';
import { colors } from '../utils/theme';

/**
 * Guardados. Los favoritos se persistirán localmente y se sincronizarán con
 * la tabla FAVORITO cuando el backend exponga el endpoint.
 */
export function SavedScreen() {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <EmptyState
        icono="heart-outline"
        titulo="Tus lugares guardados"
        descripcion="Cuando marques lugares como favoritos aparecerán aquí, disponibles incluso sin conexión."
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
