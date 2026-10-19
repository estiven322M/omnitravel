import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { Badge } from '../components/Badge';
import { BrandMark } from '../components/BrandMark';
import { FilterSheet } from '../components/FilterSheet';
import { MapaWeb, type PoiEnMapa } from '../components/MapaWeb';
import { miniaturaDePoi } from '../services/mocks/fotosPoi';
import { PoiCard } from '../components/PoiCard';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { calcularRutaAccesible } from '../services/api/routes';
import { listarBarrerasComunitarias } from '../services/reportes';
import type {
  Coordenada,
  Poi,
  ReporteResumen,
  ResultadoRuta,
} from '../services/types';
import { usePoisStore } from '../store/poisStore';
import { useProfileStore } from '../store/profileStore';
import { etiquetaDeCategoria } from '../utils/categorias';
import { aplicarFiltros } from '../utils/filters';
import { distanciaKm } from '../utils/geo';
import { formatearDistancia } from '../utils/format';
import { datosDesactualizados, restriccionesDesdePerfil } from '../utils/ruta';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  shadow,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

const CENTRO_ARMENIA: Coordenada = { latitude: 4.537, longitude: -75.675 };
const CATEGORIAS_VISIBLES = 4;

type EstadoPermiso = 'pendiente' | 'concedido' | 'denegado';

/**
 * U06 — Vista de Mapa y Ruteo.
 *
 * - Mapa WebView con Leaflet + tiles OpenStreetMap (ADR-06, sin API key).
 * - Buscador de destino (nombre/categoría/dirección) y botón «Mi ubicación».
 * - Chips de categorías y filtros U05 sobre el catálogo de características.
 * - Barreras reportadas por la comunidad (reportes críticos de `reporte`)
 *   como marcadores naranja con aviso.
 * - Trazado real de la ruta accesible con Valhalla (Proceso 2) que se dibuja
 *   y encuadra en el mapa, con errores visibles y anunciados (RNF-14/RNF-17).
 * - POIs desde el backend (`GET /mapa`) con degradación a datos de
 *   demostración si el backend no responde.
 */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<MainTabParamList, 'Mapa'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const pois = usePoisStore((estado) => estado.pois);
  const poiPorId = usePoisStore((estado) => estado.poiPorId);
  const cargadoPois = usePoisStore((estado) => estado.cargado);
  const cargarPois = usePoisStore((estado) => estado.cargar);
  const fuentePois = usePoisStore((estado) => estado.fuente);
  const advertenciaPois = usePoisStore((estado) => estado.advertencia);
  const catalogo = usePoisStore((estado) => estado.catalogo);

  const filtrosActivos = useProfileStore(
    (estado) => estado.perfil?.filtrosActivos ?? [],
  );
  const necesidadesPerfil = useProfileStore(
    (estado) => estado.perfil?.necesidades ?? [],
  );
  const establecerFiltros = useProfileStore(
    (estado) => estado.establecerFiltros,
  );

  const [permiso, setPermiso] = useState<EstadoPermiso>('pendiente');
  const [ubicacionUsuario, setUbicacionUsuario] = useState<Coordenada | null>(
    null,
  );
  const [seleccionado, setSeleccionado] = useState<Poi | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoRuta | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [barreras, setBarreras] = useState<ReporteResumen[]>([]);

  // Búsqueda de destino (U06): panel + centrado de cámara.
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [centrar, setCentrar] = useState<{
    latitude: number;
    longitude: number;
    clave: number;
  } | null>(null);
  const claveCentrado = useRef(0);
  /** Origen invertido: la ruta arranca en el destino y termina en tu ubicación. */
  const [origenInvertido, setOrigenInvertido] = useState(false);

  // Carga única de POIs del equipo (BD con fallback a demo) al abrir el mapa.
  useEffect(() => {
    if (!cargadoPois) {
      void cargarPois();
    }
  }, [cargadoPois, cargarPois]);

  // Barreras críticas de la comunidad (lectura pública de `reporte`).
  useEffect(() => {
    let vigente = true;
    listarBarrerasComunitarias()
      .then((lista) => {
        if (vigente) {
          setBarreras(lista);
        }
      })
      .catch(() => {
        // Sin barreras legibles el mapa sigue siendo funcional.
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Permiso de ubicación con degradación elegante (sin bloquear el mapa).
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (activo) {
            setPermiso('denegado');
          }
          return;
        }
        const posicion = await Location.getCurrentPositionAsync({});
        if (activo) {
          setPermiso('concedido');
          setUbicacionUsuario({
            latitude: posicion.coords.latitude,
            longitude: posicion.coords.longitude,
          });
        }
      } catch {
        if (activo) {
          setPermiso('denegado');
        }
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  // Destino preseleccionado al llegar desde "Cómo llegar" (U08).
  const destinoParam = route.params?.destinoPoiId;
  useEffect(() => {
    if (destinoParam) {
      const poi = poiPorId(destinoParam);
      if (poi) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSeleccionado(poi);
        setDestinoId(poi.id);
      }
    }
  }, [destinoParam, poiPorId]);

  const destino = destinoId ? poiPorId(destinoId) : undefined;

  /** POIs que pasan los filtros de accesibilidad (U05). */
  const poisFiltrados = useMemo(
    () => aplicarFiltros(pois, filtrosActivos),
    [pois, filtrosActivos],
  );

  const categorias = useMemo(
    () =>
      Array.from(new Set(pois.map((poi) => poi.categoria))).sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [pois],
  );

  /** POIs visibles en el mapa según filtros + chip de categoría activo. */
  const poisVisibles = useMemo(
    () =>
      categoriaActiva === 'Todos'
        ? poisFiltrados
        : poisFiltrados.filter((poi) => poi.categoria === categoriaActiva),
    [poisFiltrados, categoriaActiva],
  );

  /** Marcadores del mapa: barreras primero (sustituyen al POI base). */
  const marcadores = useMemo(() => {
    const idsConBarrera = new Set(barreras.map((barrera) => barrera.poiId));
    const lista: PoiEnMapa[] = [];

    for (const poi of poisVisibles) {
      const esBarrera = idsConBarrera.has(poi.id);
      lista.push({
        id: poi.id,
        nombre: poi.nombre,
        latitud: poi.latitud,
        longitud: poi.longitud,
        activo: seleccionado?.id === poi.id,
        pendiente: poi.estadoVerificacion === 'PENDIENTE',
        barrera: esBarrera,
        descripcion: esBarrera
          ? (barreras.find((barrera) => barrera.poiId === poi.id)
              ?.descripcion ?? 'Reportada por la comunidad')
          : undefined,
        foto: miniaturaDePoi(poi.nombre, poi.categoria),
        // Caminata a ~4,8 km/h (80 m/min) desde tu ubicación (U06).
        detalle: ubicacionUsuario
          ? `A ${Math.max(
              1,
              Math.round(
                (distanciaKm(ubicacionUsuario, {
                  latitude: poi.latitud,
                  longitude: poi.longitud,
                }) *
                  1000) /
                  80,
              ),
            )} min`
          : poi.categoria,
        accesible: poi.estadoVerificacion === 'VERIFICADO',
      });
    }
    return lista;
  }, [poisVisibles, barreras, seleccionado?.id, ubicacionUsuario]);

  /** Resultados de la búsqueda en TODO el catálogo (nombre/categoría/dirección). */
  const termino = busqueda.trim().toLowerCase();
  const resultadosBusqueda = useMemo(() => {
    if (termino.length < 2) {
      return [];
    }
    return pois
      .filter(
        (poi) =>
          poi.nombre.toLowerCase().includes(termino) ||
          poi.categoria.toLowerCase().includes(termino) ||
          poi.direccion.toLowerCase().includes(termino),
      )
      .slice(0, 6);
  }, [pois, termino]);

  // Índice del catálogo para rotular los valores del destino (rampas, etc.).
  const caracteristicaPorId = useMemo(
    () =>
      new Map(
        catalogo.map((caracteristica) => [caracteristica.id, caracteristica]),
      ),
    [catalogo],
  );

  /** Ficha accesible del destino: Sí/No/valor con los datos de la BD. */
  const chipsDestino = useMemo(() => {
    if (!destino) {
      return [];
    }
    return destino.valores
      .slice(0, 6)
      .map((valor) => {
        const caracteristica = caracteristicaPorId.get(valor.caracteristicaId);
        if (!caracteristica) {
          return null;
        }
        const tipo = (caracteristica.tipoValor ?? '').toUpperCase();
        if (tipo === 'BOOLEANO') {
          return {
            id: valor.caracteristicaId,
            etiqueta: `${valor.valorBooleano === true ? 'Sí' : 'No'}: ${caracteristica.nombre}`,
            cumple: valor.valorBooleano === true,
          };
        }
        if (tipo === 'NUMERICO') {
          return {
            id: valor.caracteristicaId,
            etiqueta:
              `${caracteristica.nombre}: ${valor.valorNumerico ?? ''} ${caracteristica.unidad ?? ''}`.trim(),
            cumple: true,
          };
        }
        return {
          id: valor.caracteristicaId,
          etiqueta: valor.valorTexto
            ? `${caracteristica.nombre}: ${valor.valorTexto}`
            : caracteristica.nombre,
          cumple: true,
        };
      })
      .filter(
        (chip): chip is { id: string; etiqueta: string; cumple: boolean } =>
          chip != null,
      );
  }, [destino, caracteristicaPorId]);

  // Restricciones del Proceso 2 derivadas del perfil local de accesibilidad.
  const restricciones = useMemo(
    () => restriccionesDesdePerfil(necesidadesPerfil, filtrosActivos),
    [necesidadesPerfil, filtrosActivos],
  );

  const origen = useMemo<Coordenada>(() => {
    if (origenInvertido && destino) {
      return { latitude: destino.latitud, longitude: destino.longitud };
    }
    return ubicacionUsuario ?? CENTRO_ARMENIA;
  }, [origenInvertido, destino, ubicacionUsuario]);

  /** Coordenadas del destino efectivo (tu ubicación si se invirtió el origen). */
  const destinoCoordenada = useMemo<Coordenada | null>(() => {
    if (origenInvertido) {
      return ubicacionUsuario;
    }
    if (!destino) {
      return null;
    }
    return { latitude: destino.latitud, longitude: destino.longitud };
  }, [origenInvertido, destino, ubicacionUsuario]);

  const nombreDestino = origenInvertido
    ? 'Tu ubicación actual'
    : (destino?.nombre ?? null);

  const seleccionarPoiPorId = useCallback(
    (idPoi: string) => {
      const poi = poiPorId(idPoi);
      if (!poi) {
        return;
      }
      setSeleccionado(poi);
      setDestinoId(poi.id);
      setResultado(null);
      setErrorRuta(null);
      setOrigenInvertido(false);
    },
    [poiPorId],
  );

  /** El WebView de Leaflet puede fallar si falta internet o el CDN. */
  const [estadoMapaWeb, setEstadoMapaWeb] = useState<
    'cargando' | 'listo' | 'sin-red'
  >('cargando');
  const marcarListo = useCallback(() => setEstadoMapaWeb('listo'), []);
  useEffect(() => {
    const id = setTimeout(() => {
      setEstadoMapaWeb((anterior) =>
        anterior === 'cargando' ? 'sin-red' : anterior,
      );
    }, 10000);
    return () => clearTimeout(id);
  }, []);

  /** Selecciona un lugar y centra la cámara (búsqueda / mi ubicación). */
  const centrarEn = useCallback(
    (poi: Poi) => {
      seleccionarPoiPorId(poi.id);
      claveCentrado.current += 1;
      setCentrar({
        latitude: poi.latitud,
        longitude: poi.longitud,
        clave: claveCentrado.current,
      });
      setBusqueda('');
      setBusquedaAbierta(false);
    },
    [seleccionarPoiPorId],
  );

  /** Centro sobre el punto donde está la persona (si ya lo concedió). */
  const irAMiUbicacion = useCallback(() => {
    if (!ubicacionUsuario) {
      const aviso =
        'No tenemos tu ubicación actual: concede el permiso en Ajustes y recarga la app.';
      // En Android lo anuncia la región viva del aviso de permiso.
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(aviso);
      }
      return;
    }
    claveCentrado.current += 1;
    setCentrar({
      latitude: ubicacionUsuario.latitude,
      longitude: ubicacionUsuario.longitude,
      clave: claveCentrado.current,
    });
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(
        'Mapa centrado en tu ubicación',
      );
    }
  }, [ubicacionUsuario]);

  const verRuta = useCallback(async () => {
    if (!destinoCoordenada) {
      return;
    }
    setCargandoRuta(true);
    setErrorRuta(null);
    setResultado(null);

    try {
      const ruta = await calcularRutaAccesible(
        origen,
        destinoCoordenada,
        restricciones,
      );
      setResultado(ruta);
      // En Android el anuncio lo hace la región viva del resultado.
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          `Ruta calculada: ${ruta.duracionMin} minutos, ${formatearDistancia(ruta.distanciaKm)}.`,
        );
      }
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : 'No se pudo calcular la ruta. Inténtalo de nuevo.';
      setErrorRuta(mensaje);
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(mensaje);
      }
    } finally {
      setCargandoRuta(false);
    }
  }, [destinoCoordenada, origen, restricciones]);

  const limpiarDestino = () => {
    setSeleccionado(null);
    setDestinoId(null);
    setResultado(null);
    setErrorRuta(null);
    setOrigenInvertido(false);
  };

  return (
    <View style={estilos.pantalla}>
      <View
        style={estilos.mapa}
        accessibilityLabel="Mapa de lugares accesibles en Armenia"
      >
        <MapaWeb
          pois={marcadores}
          vistaInicial={CENTRO_ARMENIA}
          ruta={
            resultado?.coordenadas
              ? { coordenadas: resultado.coordenadas }
              : null
          }
          ubicacionUsuario={ubicacionUsuario}
          centrar={centrar}
          onPoiPulsado={seleccionarPoiPorId}
          onListo={marcarListo}
        />

        <Pressable
          onPress={irAMiUbicacion}
          style={estilos.botonMiUbicacion}
          accessibilityRole="button"
          accessibilityLabel="Centrar el mapa en mi ubicación actual"
          accessibilityHint="Mueve la cámara al punto donde estás"
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[estilos.barraSuperior, { top: insets.top + spacing.sm }]}>
        <View style={estilos.filaEncabezado}>
          <View style={estilos.marca}>
            <BrandMark tamano={40} variante="completo" />
          </View>
          <View style={estilos.accionesEncabezado}>
            <Pressable
              onPress={() => setBusquedaAbierta((abierta) => !abierta)}
              style={estilos.botonIcono}
              accessibilityRole="button"
              accessibilityLabel="Buscar un lugar"
              accessibilityHint="Abre el buscador de destinos"
            >
              <Ionicons name="search" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setFiltrosAbiertos(true)}
              style={estilos.botonIcono}
              accessibilityRole="button"
              accessibilityLabel={`Filtros de accesibilidad${
                filtrosActivos.length > 0
                  ? `, ${filtrosActivos.length} activos`
                  : ', ninguno activo'
              }`}
              accessibilityHint="Abre el panel de filtros"
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={colors.primary}
              />
              {filtrosActivos.length > 0 ? (
                <View style={estilos.contador}>
                  <Text style={estilos.contadorTexto}>
                    {filtrosActivos.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.chips}
          accessibilityLabel="Categorías de lugares"
        >
          {['Todos', ...categorias.slice(0, CATEGORIAS_VISIBLES)].map(
            (categoria) => {
              const activa = categoriaActiva === categoria;
              return (
                <Pressable
                  key={categoria}
                  onPress={() => setCategoriaActiva(categoria)}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoría ${
                    categoria === 'Todos'
                      ? categoria
                      : etiquetaDeCategoria(categoria)
                  }`}
                  accessibilityState={{ selected: activa }}
                  style={[
                    estilos.chip,
                    activa ? estilos.chipActivo : estilos.chipInactivo,
                  ]}
                >
                  <Text
                    style={[
                      estilos.chipTexto,
                      activa ? estilos.chipTextoActivo : null,
                    ]}
                  >
                    {categoria === 'Todos'
                      ? categoria
                      : etiquetaDeCategoria(categoria)}
                  </Text>
                </Pressable>
              );
            },
          )}
          {categorias.length > CATEGORIAS_VISIBLES ? (
            <Pressable
              onPress={() => {
                setCategoriaActiva('Todos');
                setFiltrosAbiertos(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="⋯ Más"
              accessibilityHint="Abre el panel con todas las categorías y filtros de accesibilidad"
              style={[estilos.chip, estilos.chipInactivo]}
            >
              <Text style={estilos.chipTexto}>⋯ Más</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {busquedaAbierta ? (
          <View style={estilos.panelBusqueda}>
            <View style={estilos.campoBusqueda}>
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.textSecondary}
              />
              <TextInput
                style={estilos.inputBusqueda}
                placeholder="Busca destinos, lugares o servicios…"
                placeholderTextColor={colors.textMuted}
                value={busqueda}
                onChangeText={setBusqueda}
                autoFocus
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

            {termino.length < 2 ? (
              <Text style={estilos.textoAyudaBusqueda}>
                Escribe al menos 2 letras del nombre, categoría o dirección.
              </Text>
            ) : resultadosBusqueda.length === 0 ? (
              <Text style={estilos.textoAyudaBusqueda}>
                No encontramos lugares con «{busqueda.trim()}».
              </Text>
            ) : (
              resultadosBusqueda.map((poi) => (
                <Pressable
                  key={poi.id}
                  onPress={() => centrarEn(poi)}
                  accessibilityRole="button"
                  accessibilityLabel={`${poi.nombre}, ${poi.categoria}. Usar como destino`}
                  style={estilos.filaResultado}
                >
                  <View style={estilos.iconoResultado}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={estilos.textosResultado}>
                    <Text style={estilos.nombreResultado} numberOfLines={1}>
                      {poi.nombre}
                    </Text>
                    <Text style={estilos.detalleResultado} numberOfLines={1}>
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
      </View>

      <View
        style={[estilos.panel, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={estilos.contenidoPanel}
        >
          {fuentePois === 'mock' ? (
            <View style={estilos.avisoDatos} accessibilityLiveRegion="polite">
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={estilos.avisoDatosTexto} numberOfLines={2}>
                {advertenciaPois ??
                  'Mostrando lugares de demostración: sin conexión a la base de datos del equipo.'}
              </Text>
            </View>
          ) : null}

          {estadoMapaWeb === 'sin-red' ? (
            <View style={estilos.avisoDatos} accessibilityLiveRegion="polite">
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={estilos.avisoDatosTexto} numberOfLines={2}>
                El mapa no terminó de cargar: revisa tu conexión a internet y
                recarga la app (botón Reload en Expo Go).
              </Text>
            </View>
          ) : null}

          {seleccionado ? (
            <View style={estilos.tarjetaSeleccion}>
              <PoiCard
                poi={seleccionado}
                onPress={() =>
                  navigation.navigate('DetallePoi', { poiId: seleccionado.id })
                }
              />
              <Pressable
                onPress={limpiarDestino}
                style={estilos.botonCerrarSeleccion}
                accessibilityRole="button"
                accessibilityLabel="Quitar el destino seleccionado"
                hitSlop={6}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <View style={estilos.encabezadoRuta}>
            <View style={estilos.iconoRuta}>
              <Ionicons name="walk" size={22} color={colors.primary} />
            </View>
            <View style={estilos.textosEncabezadoRuta}>
              <Text style={estilos.tituloRuta}>Planificar Ruta Peatonal</Text>
              <Text style={estilos.subtituloRuta}>
                Encuentra la ruta más accesible para ti
              </Text>
            </View>
          </View>

          <View style={estilos.filaOrigenDestino}>
            <View style={estilos.columnaRuta}>
              <View style={estilos.filaDato}>
                <Ionicons
                  name="radio-button-off"
                  size={18}
                  color={colors.primary}
                />
                <Text style={estilos.etiquetaDato}>Origen</Text>
                <Text style={estilos.valorDato} numberOfLines={1}>
                  {origenInvertido
                    ? (destino?.nombre ?? 'Lugar seleccionado')
                    : permiso === 'concedido'
                      ? 'Tu ubicación actual'
                      : 'Centro de Armenia'}
                </Text>
              </View>

              <Pressable
                onPress={() => setBusquedaAbierta(true)}
                accessibilityRole="button"
                accessibilityLabel={`Destino: ${nombreDestino ?? '¿A dónde quieres ir?'}`}
                accessibilityHint="Abre el buscador de destinos"
                style={estilos.filaDato}
              >
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={estilos.etiquetaDato}>Destino</Text>
                <Text
                  style={[
                    estilos.valorDato,
                    nombreDestino ? null : estilos.valorDatoSuave,
                  ]}
                  numberOfLines={1}
                >
                  {nombreDestino ?? '¿A dónde quieres ir?'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setOrigenInvertido((invertido) => !invertido);
                setResultado(null);
              }}
              disabled={!destino || !ubicacionUsuario}
              accessibilityRole="button"
              accessibilityLabel="Invertir origen y destino"
              accessibilityState={{ disabled: !destino || !ubicacionUsuario }}
              style={estilos.botonInvertir}
            >
              <Ionicons
                name="swap-vertical"
                size={20}
                color={
                  destino && ubicacionUsuario
                    ? colors.primary
                    : colors.textMuted
                }
              />
            </Pressable>
          </View>

          {destino && chipsDestino.length > 0 ? (
            <View style={estilos.chipsDestino}>
              {chipsDestino.slice(0, 3).map((chip) => (
                <View
                  key={chip.id}
                  style={[
                    estilos.chipDestino,
                    chip.cumple ? estilos.chipDestinoOk : estilos.chipDestinoNo,
                  ]}
                >
                  <Ionicons
                    name={chip.cumple ? 'checkmark' : 'close'}
                    size={12}
                    color={chip.cumple ? colors.success : colors.danger}
                  />
                  <Text style={estilos.chipDestinoTexto}>{chip.etiqueta}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {resultado ? (
            <View style={estilos.resultado}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text
                style={estilos.resultadoTexto}
                accessibilityLiveRegion="polite"
              >
                {resultado.duracionMin} min ·{' '}
                {formatearDistancia(resultado.distanciaKm)}
              </Text>
              <Badge tono="exito" texto="Ruta calculada" />
            </View>
          ) : null}

          {resultado &&
          destino &&
          datosDesactualizados(destino.ultimaVerificacion) ? (
            <View style={estilos.avisoDatos} accessibilityLiveRegion="polite">
              <Ionicons name="time-outline" size={16} color={colors.warning} />
              <Text style={estilos.avisoDatosTexto}>
                Los datos de accesibilidad de este lugar superan los 60 días o
                no están verificados (RNF-27).
              </Text>
            </View>
          ) : null}

          {resultado?.advertencias && resultado.advertencias.length > 0 ? (
            <View style={estilos.avisoDatos}>
              {resultado.advertencias.map((advertencia) => (
                <View key={advertencia} style={estilos.filaDato}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={estilos.avisoDatosTexto}>{advertencia}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {errorRuta ? (
            <Text style={estilos.error} accessibilityLiveRegion="polite">
              {errorRuta}
            </Text>
          ) : null}

          <AppButton
            titulo="Ver ruta accesible"
            icono="git-compare-outline"
            onPress={verRuta}
            deshabilitado={!destinoCoordenada}
            cargando={cargandoRuta}
            pistaAccesibilidad="Calcula y dibuja la ruta peatonal más accesible hasta el destino"
          />

          {resultado && destino ? (
            <AppButton
              titulo="Iniciar navegación"
              variante="contorno"
              icono="navigate-circle-outline"
              onPress={() =>
                navigation.navigate('Navegacion', {
                  poiId: destino.id,
                  origenLat: origen.latitude,
                  origenLon: origen.longitude,
                })
              }
              pistaAccesibilidad="Abre la navegación paso a paso con las indicaciones de la ruta"
            />
          ) : null}
        </ScrollView>
      </View>

      <FilterSheet
        visible={filtrosAbiertos}
        filtrosActivos={filtrosActivos}
        onAplicar={establecerFiltros}
        onCerrar={() => setFiltrosAbiertos(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapa: {
    // El mapa nunca baja de la mitad de la pantalla (devolución del equipo):
    // el panel inferior se comprime y su contenido se desplaza dentro.
    flex: 1,
    minHeight: '50%',
  },
  barraSuperior: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  filaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  marca: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  accionesEncabezado: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botonIcono: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  contador: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  contadorTexto: {
    color: colors.white,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    minHeight: 36,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  chipActivo: {
    backgroundColor: colors.primary,
  },
  chipInactivo: {
    backgroundColor: colors.white,
  },
  chipTexto: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  chipTextoActivo: {
    color: colors.white,
  },
  panelBusqueda: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  campoBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  inputBusqueda: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  textoAyudaBusqueda: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  filaResultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  iconoResultado: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosResultado: {
    flex: 1,
    gap: 1,
  },
  nombreResultado: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  detalleResultado: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  botonMiUbicacion: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  panel: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    // Cede altura a favor del mapa cuando su contenido no cabe entero:
    // el ScrollView interno permite desplazar el resto (issue del equipo).
    flexShrink: 1,
    ...shadow.card,
  },
  contenidoPanel: {
    gap: spacing.sm,
  },
  tarjetaSeleccion: {
    marginBottom: spacing.xs,
  },
  botonCerrarSeleccion: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encabezadoRuta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconoRuta: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosEncabezadoRuta: {
    flex: 1,
    gap: 1,
  },
  tituloRuta: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtituloRuta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  filaOrigenDestino: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  columnaRuta: {
    flex: 1,
    gap: spacing.xs,
  },
  filaDato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  etiquetaDato: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  valorDato: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  valorDatoSuave: {
    color: colors.textMuted,
  },
  botonInvertir: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsDestino: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipDestino: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipDestinoOk: {
    backgroundColor: colors.successSoft,
  },
  chipDestinoNo: {
    backgroundColor: colors.dangerSoft,
  },
  chipDestinoTexto: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  resultadoTexto: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.danger,
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
});
