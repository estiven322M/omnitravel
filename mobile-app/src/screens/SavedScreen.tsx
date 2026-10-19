import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EncabezadoMarca } from '../components/EncabezadoMarca';
import { EmptyState } from '../components/EmptyState';
import { PoiCardFeed } from '../components/PoiCardFeed';
import type { RootStackParamList } from '../navigation/types';
import type { Poi } from '../services/types';
import { useFavoritosStore } from '../store/favoritosStore';
import { usePoisStore } from '../store/poisStore';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

/**
 * Guardados — favoritos del viajero sincronizados con la tabla `favorito`
 * de la BD del equipo (políticas `guardados_*`: cada usuario solo ve y
 * manipula SU lista). La lista no se inventa localmente: la BD es la verdad
 * y los POIs vienen del poisStore (BD del equipo con fallback demo).
 * Las tarjetas comparten el diseño del feed U04; el corazón lleno quita el
 * guardado (acción optimista con rollback en favoritosStore).
 */
export function SavedScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const cargadoFavoritos = useFavoritosStore((estado) => estado.cargado);
  const cargandoFavoritos = useFavoritosStore((estado) => estado.cargando);
  const errorFavoritos = useFavoritosStore((estado) => estado.error);
  const idsFavoritos = useFavoritosStore((estado) => estado.ids);
  const cargarFavoritos = useFavoritosStore((estado) => estado.cargar);

  const cargadoPois = usePoisStore((estado) => estado.cargado);
  const pois = usePoisStore((estado) => estado.pois);
  const cargarPois = usePoisStore((estado) => estado.cargar);

  useEffect(() => {
    if (!cargadoFavoritos) {
      void cargarFavoritos();
    }
  }, [cargadoFavoritos, cargarFavoritos]);

  useEffect(() => {
    if (!cargadoPois) {
      void cargarPois();
    }
  }, [cargadoPois, cargarPois]);

  /** Guardados en su orden de la BD (recientes primero) con ficha conocida. */
  const guardados = idsFavoritos
    .map((id) => pois.find((poi) => poi.id === id))
    .filter((poi): poi is Poi => poi != null);

  const irAlMapa = () => {
    navigation.navigate('Principal', { screen: 'Mapa' });
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <EncabezadoMarca tamanoLogo={42} />
        <View style={estilos.filaTitulo}>
          <Text style={estilos.titulo} accessibilityRole="header">
            Tus lugares guardados
          </Text>
          {cargadoFavoritos && guardados.length > 0 ? (
            <View style={estilos.contador}>
              <Text style={estilos.contadorTexto}>{guardados.length}</Text>
            </View>
          ) : null}
        </View>
        <Text style={estilos.subtitulo}>
          {cargadoFavoritos
            ? `${guardados.length} ${guardados.length === 1 ? 'lugar guardado' : 'lugares guardados'} en tu cuenta.`
            : 'Consultando tus favoritos…'}
        </Text>

        {errorFavoritos ? (
          <View style={estilos.aviso} accessibilityLiveRegion="polite">
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color={colors.warning}
            />
            <Text style={estilos.textoAviso}>{errorFavoritos}</Text>
          </View>
        ) : null}

        {cargandoFavoritos && guardados.length === 0 ? (
          <Text style={estilos.textoProceso}>
            Cargando tus lugares guardados…
          </Text>
        ) : null}

        {cargadoFavoritos && guardados.length === 0 ? (
          <EmptyState
            icono="heart-outline"
            titulo="Aún no guardas lugares"
            descripcion="Abre un lugar del mapa y pulsa el corazón para tenerlo a mano aquí."
            textoBoton="Ir al mapa"
            onPressBoton={irAlMapa}
          />
        ) : (
          guardados.map((poi) => (
            <PoiCardFeed
              key={poi.id}
              poi={poi}
              onPress={() =>
                navigation.navigate('DetallePoi', { poiId: poi.id })
              }
            />
          ))
        )}

        {guardados.length > 0 ? (
          <Text style={estilos.nota}>
            Tus guardados viven en la base de datos del equipo: aparecerán en
            este teléfono y en cualquier dispositivo donde inicies sesión.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenido: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titulo: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  contador: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  contadorTexto: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  textoAviso: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  textoProceso: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  nota: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
