import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { AvisoSinConexion } from '../components/AvisoSinConexion';
import { EmptyState } from '../components/EmptyState';
import { FilterSheet } from '../components/FilterSheet';
import { PoiCardFeed } from '../components/PoiCardFeed';
import type { RootStackParamList } from '../navigation/types';
import type { Coordenada, Poi } from '../services/types';
import { usePoisStore } from '../store/poisStore';
import { useProfileStore } from '../store/profileStore';
import { coincideBusqueda, sugerenciasDeBusqueda } from '../utils/busqueda';
import { etiquetaDeCategoria, iconoDeCategoria } from '../utils/categorias';
import { aplicarFiltros } from '../utils/filters';
import { distanciaKm } from '../utils/geo';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

/** Mínimo de letras para filtrar el feed por texto (evita listas completas). */
const MINIMO_BUSQUEDA = 1;

interface EntradaFeed {
  poi: Poi;
  /** Distancia en línea recta desde tu ubicación; ausente sin permiso. */
  km?: number;
}

/**
 * U04 — Inicio (feed de lugares accesibles).
 *
 * Cabecera de marca con campana y avatar, buscador de lugares, chips de
 * categorías, filtros U05 y la lista «Lugares cerca de ti» ordenada por
 * distancia real desde la ubicación de la persona (si concedió el permiso).
 * Los datos provienen de la BD del equipo vía poisStore, con distancia y
 * conteo de validaciones comunitarias tal como exige el mockup.
 */
export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const nombre = useProfileStore((estado) => estado.perfil?.nombre);
  const fotoUri = useProfileStore((estado) => estado.perfil?.fotoUri);
  const filtrosActivos = useProfileStore(
    (estado) => estado.perfil?.filtrosActivos ?? [],
  );
  const establecerFiltros = useProfileStore(
    (estado) => estado.establecerFiltros,
  );

  const pois = usePoisStore((estado) => estado.pois);
  const cargadoPois = usePoisStore((estado) => estado.cargado);
  const sinConexionPois = usePoisStore(
    (estado) => estado.fuente === 'sin-conexion',
  );
  const cargarPois = usePoisStore((estado) => estado.cargar);

  const [ubicacion, setUbicacion] = useState<Coordenada | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  // Carga única de POIs del equipo (BD con fallback a demo) al abrir el feed.
  useEffect(() => {
    if (!cargadoPois) {
      void cargarPois();
    }
  }, [cargadoPois, cargarPois]);

  // Ubicación para ordenar por cercanía; sin permiso el feed sigue completo.
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
        const posicion = await Location.getCurrentPositionAsync({});
        if (activo) {
          setUbicacion({
            latitude: posicion.coords.latitude,
            longitude: posicion.coords.longitude,
          });
        }
      } catch {
        // Sin ubicación el feed conserva el orden de la BD.
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const categorias = useMemo(
    () =>
      Array.from(new Set(pois.map((poi) => poi.categoria))).sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [pois],
  );

  const termino = busqueda.trim().toLowerCase();

  /** Lugares visibles: filtros U05 → chip de categoría → texto buscado. */
  const entradas = useMemo<EntradaFeed[]>(() => {
    let lista = aplicarFiltros(pois, filtrosActivos);
    if (categoriaActiva) {
      lista = lista.filter((poi) => poi.categoria === categoriaActiva);
    }
    if (termino.length >= MINIMO_BUSQUEDA) {
      lista = lista.filter((poi) => coincideBusqueda(poi, termino));
    }
    if (!ubicacion) {
      return lista.map((poi) => ({ poi }));
    }
    return lista
      .map((poi) => ({
        poi,
        km: distanciaKm(ubicacion, {
          latitude: poi.latitud,
          longitude: poi.longitud,
        }),
      }))
      .sort((a, b) => a.km - b.km);
  }, [pois, filtrosActivos, categoriaActiva, termino, ubicacion]);

  /** Sugerencias mientras se escribe (en todo el catálogo). */
  const [sugerenciasVisibles, setSugerenciasVisibles] = useState(false);
  const sugerencias = useMemo(
    () => sugerenciasDeBusqueda(pois, termino),
    [pois, termino],
  );

  const hayFiltrosActivos =
    filtrosActivos.length > 0 || categoriaActiva != null || termino !== '';

  const limpiarTodo = () => {
    establecerFiltros([]);
    setCategoriaActiva(null);
    setBusqueda('');
  };

  const irAlMapa = () => {
    navigation.navigate('Principal', { screen: 'Mapa' });
  };

  const irAlPerfil = () => {
    navigation.navigate('Principal', { screen: 'Perfil' });
  };

  const abrirNotificaciones = () => navigation.navigate('Notificaciones');

  const primerNombre = nombre?.split(' ')[0] || 'viajero';

  const encabezado = (
    <View style={estilos.encabezado}>
      <View style={estilos.filaEncabezado}>
        <BrandMark tamano={42} variante="completo" />
        <View style={estilos.accionesEncabezado}>
          <Pressable
            onPress={abrirNotificaciones}
            style={estilos.botonIcono}
            accessibilityRole="button"
            accessibilityLabel="Notificaciones"
            accessibilityHint="Abre tus notificaciones"
          >
            <Ionicons
              name="notifications-outline"
              size={26}
              color={colors.navy}
            />
          </Pressable>
          <Pressable
            onPress={irAlPerfil}
            accessibilityRole="button"
            accessibilityLabel="Abrir tu perfil"
            style={estilos.avatar}
          >
            {fotoUri ? (
              <Image
                source={{ uri: fotoUri }}
                style={estilos.avatarFoto}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text style={estilos.avatarInicial}>
                {primerNombre.charAt(0).toUpperCase()}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <Text style={estilos.saludo}>¡Hola, {primerNombre}!</Text>
      <Text style={estilos.pregunta}>¿Qué lugar quieres descubrir hoy?</Text>

      <View style={estilos.filaBusqueda}>
        <View style={estilos.campoBusqueda}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={estilos.inputBusqueda}
            placeholder="Busca destinos, lugares o servicios…"
            placeholderTextColor={colors.textMuted}
            value={busqueda}
            onChangeText={(texto) => {
              setBusqueda(texto);
              setSugerenciasVisibles(true);
            }}
            onFocus={() => setSugerenciasVisibles(true)}
            onSubmitEditing={() => setSugerenciasVisibles(false)}
            accessibilityLabel="Buscar destinos, lugares o servicios"
            autoComplete="off"
            returnKeyType="search"
          />
          {busqueda !== '' ? (
            <Pressable
              onPress={() => setBusqueda('')}
              accessibilityRole="button"
              accessibilityLabel="Borrar la búsqueda"
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setFiltrosAbiertos(true)}
          style={estilos.botonFiltros}
          accessibilityRole="button"
          accessibilityLabel={`Filtros de accesibilidad${
            filtrosActivos.length > 0
              ? `, ${filtrosActivos.length} activos`
              : ', ninguno activo'
          }`}
          accessibilityHint="Abre el panel de filtros"
        >
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          {filtrosActivos.length > 0 ? (
            <View style={estilos.contador}>
              <Text style={estilos.contadorTexto}>{filtrosActivos.length}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {sugerenciasVisibles && termino !== '' ? (
        <View
          style={estilos.sugerencias}
          accessibilityLabel="Sugerencias de búsqueda"
        >
          {sugerencias.length === 0 ? (
            <Text style={estilos.sinSugerencias}>
              No encontramos lugares con «{busqueda.trim()}».
            </Text>
          ) : (
            sugerencias.map((poi) => (
              <Pressable
                key={poi.id}
                onPress={() => {
                  setSugerenciasVisibles(false);
                  navigation.navigate('DetallePoi', { poiId: poi.id });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${poi.nombre}, ${poi.categoria}. Ver detalle`}
                style={({ pressed }) => [
                  estilos.filaSugerencia,
                  pressed ? estilos.filaSugerenciaPresionada : null,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.primary}
                />
                <View style={estilos.textosSugerencia}>
                  <Text style={estilos.nombreSugerencia} numberOfLines={1}>
                    {poi.nombre}
                  </Text>
                  <Text style={estilos.detalleSugerencia} numberOfLines={1}>
                    {poi.categoria} · {poi.direccion || poi.ciudad}
                  </Text>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <AvisoSinConexion />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chips}
        accessibilityLabel="Categorías de lugares"
      >
        {categorias.map((categoria) => {
          const activa = categoriaActiva === categoria;
          return (
            <Pressable
              key={categoria}
              onPress={() => setCategoriaActiva(activa ? null : categoria)}
              accessibilityRole="button"
              accessibilityLabel={`Categoría ${etiquetaDeCategoria(categoria)}`}
              accessibilityState={{ selected: activa }}
              style={[estilos.chip, activa ? estilos.chipActivo : null]}
            >
              <Ionicons
                name={iconoDeCategoria(categoria)}
                size={15}
                color={activa ? colors.white : colors.primary}
              />
              <Text
                style={[
                  estilos.chipTexto,
                  activa ? estilos.chipTextoActivo : null,
                ]}
              >
                {etiquetaDeCategoria(categoria)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={estilos.filaSeccion}>
        <View style={estilos.tituloSeccion}>
          <Ionicons name="location" size={18} color={colors.primary} />
          <Text style={estilos.textoTituloSeccion} accessibilityRole="header">
            Lugares cerca de ti
          </Text>
        </View>
        <Pressable
          onPress={irAlMapa}
          accessibilityRole="button"
          accessibilityLabel="Ver mapa"
          accessibilityHint="Abre la pantalla del mapa con los lugares accesibles"
          style={estilos.botonVerMapa}
        >
          <Text style={estilos.textoVerMapa}>Ver mapa</Text>
          <Ionicons name="map-outline" size={16} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <FlatList
        data={entradas}
        keyExtractor={(entrada) => entrada.poi.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={estilos.contenido}
        ListHeaderComponent={encabezado}
        renderItem={({ item }) => (
          <PoiCardFeed
            poi={item.poi}
            distanciaKm={item.km}
            onPress={() =>
              navigation.navigate('DetallePoi', { poiId: item.poi.id })
            }
          />
        )}
        ListEmptyComponent={
          cargadoPois && !sinConexionPois ? (
            <EmptyState
              icono="search-outline"
              titulo="Sin lugares que coincidan"
              descripcion={
                hayFiltrosActivos
                  ? 'Prueba con otra palabra, otra categoría o quita algún filtro de accesibilidad.'
                  : 'La base de datos no tiene lugares publicados por ahora.'
              }
              textoBoton={
                hayFiltrosActivos ? 'Limpiar búsqueda y filtros' : undefined
              }
              onPressBoton={hayFiltrosActivos ? limpiarTodo : undefined}
            />
          ) : (
            <Text
              style={estilos.textoCargando}
              accessibilityLiveRegion="polite"
            >
              Cargando lugares accesibles…
            </Text>
          )
        }
      />

      <FilterSheet
        visible={filtrosAbiertos}
        filtrosActivos={filtrosActivos}
        onAplicar={establecerFiltros}
        onCerrar={() => setFiltrosAbiertos(false)}
      />
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
  encabezado: {
    gap: spacing.sm,
  },
  filaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  accionesEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  botonIcono: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarFoto: {
    width: '100%',
    height: '100%',
  },
  avatarInicial: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  saludo: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  pregunta: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  sugerencias: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingVertical: spacing.xs,
    shadowColor: '#0B1B3F',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  filaSugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  filaSugerenciaPresionada: {
    backgroundColor: colors.surface,
  },
  textosSugerencia: {
    flex: 1,
  },
  nombreSugerencia: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  detalleSugerencia: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  sinSugerencias: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filaBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  campoBusqueda: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    backgroundColor: colors.white,
  },
  inputBusqueda: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  botonFiltros: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contador: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  contadorTexto: {
    color: colors.white,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  avisoDatos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  avisoDatosTexto: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.navy,
  },
  chipTextoActivo: {
    color: colors.white,
  },
  filaSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tituloSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  textoTituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  botonVerMapa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET,
  },
  textoVerMapa: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  textoCargando: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
