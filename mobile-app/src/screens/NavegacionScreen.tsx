import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MapaWeb } from '../components/MapaWeb';
import type { RootStackParamList } from '../navigation/types';
import { calcularRutaAccesible } from '../services/api/routes';
import type { PasoRuta, ResultadoRuta } from '../services/types';
import { usePoisStore } from '../store/poisStore';
import { useProfileStore } from '../store/profileStore';
import { formatearDistancia } from '../utils/format';
import {
  datosDesactualizados,
  iconoDeManeuver,
  restriccionesDesdePerfil,
} from '../utils/ruta';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  shadow,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

const ETIQUETA_PERFIL: Record<string, string> = {
  silla_de_ruedas: 'Perfil silla de ruedas',
  visual: 'Perfil visual',
  peatonal: 'Perfil peatonal',
};

/**
 * U07 — Navegación paso a paso.
 *
 * Calcula la ruta accesible al destino con las restricciones del perfil
 * (motriz → sin escaleras + ascensores; visual → narración asistida), la
 * dibuja sobre el mismo mapa Leaflet/WebView de U06 (MapaWeb) y la guía con:
 *
 * - Tarjeta azul de maniobra actual (como el mockup: ícono + instrucción).
 * - «Guía por voz» (expo-speech, es-ES) que narra la maniobra vigente.
 * - Tiempo estimado, distancia y sello de ruta libre de escalones (RNF-27).
 * - Lista de pasos navegable y botón rojo «Finalizar ruta».
 */
export function NavegacionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Navegacion'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { poiId, origenLat, origenLon } = route.params;

  const poiPorId = usePoisStore((estado) => estado.poiPorId);
  const poi = poiPorId(poiId);

  const necesidades = useProfileStore(
    (estado) => estado.perfil?.necesidades ?? [],
  );
  const filtrosActivos = useProfileStore(
    (estado) => estado.perfil?.filtrosActivos ?? [],
  );
  const restricciones = useMemo(
    () => restriccionesDesdePerfil(necesidades, filtrosActivos),
    [necesidades, filtrosActivos],
  );

  const [resultado, setResultado] = useState<ResultadoRuta | null | undefined>(
    undefined,
  );
  /**
   * true cuando el usuario alternó a la ruta alternativa con «Recalcular»
   * (Valhalla `alternates`): el recálculo muestra un camino distinto.
   */
  const [usarAlternativa, setUsarAlternativa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalculo, setRecalculo] = useState(0);
  const [avisoRecalculo, setAvisoRecalculo] = useState<string | null>(null);
  const [guiaVoz, setGuiaVoz] = useState(false);
  const [indicePaso, setIndicePaso] = useState(0);

  const cargando = resultado === undefined && !error;
  /**
   * Ruta que se guía en este momento: la principal o la alternativa elegida
   * con «Recalcular ruta». Los datos nulos vuelven a la principal.
   */
  const rutaMostrada =
    usarAlternativa && resultado?.alternativa
      ? resultado.alternativa
      : resultado;
  const pasos = rutaMostrada?.pasos ?? [];
  const pasoActual: PasoRuta | undefined = pasos[indicePaso];

  // Calcula (y recalcula) la ruta: los estados se fijan en los callbacks
  // de la promesa, nunca de forma síncrona dentro del efecto.
  useEffect(() => {
    let vigente = true;
    if (!poi) {
      return undefined;
    }

    calcularRutaAccesible(
      { latitude: origenLat, longitude: origenLon },
      { latitude: poi.latitud, longitude: poi.longitud },
      restricciones,
    )
      .then((ruta) => {
        if (!vigente) {
          return;
        }
        setResultado(ruta);
        // Cada cálculo nuevo muestra la ruta principal hasta nuevo recálculo.
        setUsarAlternativa(false);
        setError(null);
        setIndicePaso(0);
        if (Platform.OS === 'ios') {
          AccessibilityInfo.announceForAccessibility(
            `Ruta calculada: ${ruta.duracionMin} minutos, ${formatearDistancia(
              ruta.distanciaKm,
            )}, ${ruta.pasos?.length ?? 0} pasos.`,
          );
        }
      })
      .catch((fallo) => {
        if (!vigente) {
          return;
        }
        setResultado(null);
        setError(
          fallo instanceof Error
            ? fallo.message
            : 'No fue posible calcular la ruta. Inténtalo de nuevo.',
        );
      });

    return () => {
      vigente = false;
    };
  }, [poi, origenLat, origenLon, restricciones, recalculo]);

  // Guía por voz: narra la maniobra vigente cuando está activa (es-ES).
  useEffect(() => {
    if (!guiaVoz || !pasoActual?.instruccion) {
      return;
    }
    Speech.stop();
    Speech.speak(pasoActual.instruccion, { language: 'es-ES' });
  }, [guiaVoz, indicePaso, pasoActual?.instruccion]);

  // Al salir de la navegación se corta cualquier narración pendiente.
  useEffect(() => () => void Speech.stop(), []);

  const alternarGuiaVoz = useCallback(() => {
    setGuiaVoz((activa) => {
      if (activa) {
        void Speech.stop();
      }
      return !activa;
    });
  }, []);

  if (!poi) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EmptyState
          icono="alert-circle-outline"
          titulo="Destino no encontrado"
          descripcion="No pudimos cargar la información de este lugar."
          textoBoton="Volver"
          onPressBoton={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const desactualizado = datosDesactualizados(poi.ultimaVerificacion);
  const etiquetaPerfil =
    ETIQUETA_PERFIL[rutaMostrada?.perfil ?? 'peatonal'] ?? 'Ruta accesible';

  /** Sella la ruta como libre de escalones cuando la narración no las menciona. */
  const hayEscaleras = pasos.some((paso) =>
    /escal\w+|stairs/i.test(paso.instruccion),
  );

  const recalcular = (aviso?: string) => {
    if (resultado?.alternativa) {
      // El motor encontró un camino distinto (Valhalla alternates): se cambia
      // a él en lugar de repetir el mismo trayecto. Al pulsar de nuevo
      // vuelve a la ruta principal.
      const mostrarAlternativa = !usarAlternativa;
      setUsarAlternativa(mostrarAlternativa);
      setAvisoRecalculo(
        aviso ?? 'Ruta recalculada: se muestra un camino accesible distinto.',
      );
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          mostrarAlternativa
            ? 'Ruta alternativa accesible mostrada.'
            : 'Ruta principal restaurada.',
        );
      }
      return;
    }
    // Sin alternativas del motor: reintenta la búsqueda completa.
    setAvisoRecalculo(aviso ?? null);
    setError(null);
    setResultado(undefined);
    setRecalculo((numero) => numero + 1);
  };

  const avanzarPaso = () => {
    setIndicePaso((indice) =>
      Math.min(indice + 1, Math.max(pasos.length - 1, 0)),
    );
  };

  return (
    <View style={estilos.pantalla}>
      <SafeAreaView edges={['top']} style={estilos.encabezadoSeguro}>
        <View style={estilos.barraNavegacion}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={estilos.botonAtras}
            accessibilityRole="button"
            accessibilityLabel="Volver al mapa"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <View style={estilos.marca}>
            <BrandMark tamano={38} variante="completo" />
          </View>
          <Pressable
            onPress={alternarGuiaVoz}
            accessibilityRole="button"
            accessibilityLabel="Guía por voz"
            accessibilityState={{ selected: guiaVoz }}
            accessibilityHint={
              guiaVoz
                ? 'Desactiva la narración de las indicaciones'
                : 'Narra en voz alta cada indicación'
            }
            style={[
              estilos.botonGuia,
              guiaVoz ? estilos.botonGuiaActivo : null,
            ]}
          >
            <Ionicons
              name={guiaVoz ? 'volume-high' : 'volume-high-outline'}
              size={18}
              color={guiaVoz ? colors.white : colors.primary}
            />
            <Text
              style={[
                estilos.textoGuia,
                guiaVoz ? estilos.textoGuiaActivo : null,
              ]}
            >
              Guía por voz
            </Text>
          </Pressable>
        </View>

        {/* Tarjeta azul de maniobra vigente (mockup U07). Sin `accessible`:
            el botón interno debe seguir alcanzable y la liveRegion anuncia
            los cambios del paso por sí misma. */}
        {pasoActual ? (
          <View
            style={estilos.tarjetaManiobra}
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name={iconoDeManeuver(pasoActual.tipo)}
              size={44}
              color={colors.white}
            />
            <View style={estilos.textosManiobra}>
              <Text style={estilos.instruccionGrande}>
                {pasoActual.instruccion}
              </Text>
              <Text style={estilos.distanciaManiobra}>
                {pasoActual.distanciaKm > 0
                  ? formatearDistancia(pasoActual.distanciaKm)
                  : 'Ahora'}
              </Text>
            </View>
            {indicePaso < pasos.length - 1 ? (
              <Pressable
                onPress={avanzarPaso}
                accessibilityRole="button"
                accessibilityLabel="Siguiente indicación"
                style={estilos.botonSiguiente}
                hitSlop={8}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={20}
                  color={colors.white}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>

      <View style={estilos.mapa}>
        {cargando ? (
          <View style={estilos.cargando}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={estilos.textoCargando}
              accessibilityLiveRegion="polite"
            >
              Calculando la ruta accesible con tu perfil…
            </Text>
          </View>
        ) : (
          <MapaWeb
            pois={[
              {
                id: poi.id,
                nombre: poi.nombre,
                latitud: poi.latitud,
                longitud: poi.longitud,
                activo: true,
                pendiente: false,
              },
            ]}
            vistaInicial={{ latitude: origenLat, longitude: origenLon }}
            ruta={
              rutaMostrada?.coordenadas
                ? { coordenadas: rutaMostrada.coordenadas }
                : null
            }
            ubicacionUsuario={{ latitude: origenLat, longitude: origenLon }}
            onPoiPulsado={() => undefined}
          />
        )}
      </View>

      <View style={estilos.hoja}>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={estilos.contenidoHoja}
        >
          {error ? (
            <Card estilo={estilos.tarjetaError}>
              <View style={estilos.filaAviso}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={18}
                  color={colors.danger}
                />
                <Text
                  style={estilos.textoError}
                  accessibilityLiveRegion="polite"
                >
                  {error}
                </Text>
              </View>
              <AppButton
                titulo="Reintentar"
                variante="contorno"
                icono="refresh-outline"
                onPress={() => recalcular()}
                pistaAccesibilidad="Vuelve a calcular la ruta accesible"
              />
            </Card>
          ) : null}

          {rutaMostrada ? (
            <>
              <View style={estilos.filaEstadisticas}>
                <View style={estilos.estadistica}>
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={estilos.etiquetaEstadistica}>
                    Tiempo estimado
                  </Text>
                  <Text
                    style={estilos.valorEstadistica}
                    accessibilityLiveRegion="polite"
                  >
                    {rutaMostrada.duracionMin} min
                  </Text>
                </View>
                <View style={estilos.separadorVertical} />
                <View style={estilos.estadistica}>
                  <Ionicons
                    name="navigate-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={estilos.etiquetaEstadistica}>Distancia</Text>
                  <Text style={estilos.valorEstadistica}>
                    {formatearDistancia(rutaMostrada.distanciaKm)}
                  </Text>
                </View>
                <View
                  style={[
                    estilos.selloEscalones,
                    hayEscaleras ? estilos.selloEscalonesAviso : null,
                  ]}
                >
                  <Ionicons
                    name={hayEscaleras ? 'warning-outline' : 'walk-outline'}
                    size={22}
                    color={hayEscaleras ? colors.warning : colors.success}
                  />
                  <Text
                    style={[
                      estilos.tituloSello,
                      { color: hayEscaleras ? colors.warning : colors.success },
                    ]}
                  >
                    {hayEscaleras
                      ? 'Incluye escaleras'
                      : 'Ruta libre de escalones'}
                  </Text>
                  <Text style={estilos.detalleSello}>
                    {hayEscaleras
                      ? 'revisa los pasos marcados'
                      : 'verificada con tu perfil'}
                  </Text>
                </View>
              </View>

              <View style={estilos.filaSellos}>
                <View style={estilos.sello}>
                  <Ionicons
                    name="accessibility-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={estilos.textoSello}>{etiquetaPerfil}</Text>
                </View>
                {usarAlternativa && resultado?.alternativa ? (
                  <View style={estilos.sello}>
                    <Ionicons
                      name="git-compare-outline"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={estilos.textoSello}>Ruta alternativa</Text>
                  </View>
                ) : null}
                {!desactualizado ? (
                  <View style={estilos.sello}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={14}
                      color={colors.success}
                    />
                    <Text style={estilos.textoSello}>Datos al día</Text>
                  </View>
                ) : (
                  <View style={estilos.sello}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={colors.warning}
                    />
                    <Text style={estilos.textoSello}>Verificar al llegar</Text>
                  </View>
                )}
              </View>

              {desactualizado ? (
                <View
                  style={estilos.avisoDatos}
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={estilos.avisoDatosTexto}>
                    Los datos de accesibilidad superan los 60 días o no están
                    verificados: confirma el entorno al llegar (RNF-27).
                  </Text>
                </View>
              ) : null}

              {avisoRecalculo ? (
                <View
                  style={estilos.bloqueExito}
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons
                    name="refresh-outline"
                    size={16}
                    color={colors.success}
                  />
                  <Text style={estilos.textoExito}>{avisoRecalculo}</Text>
                </View>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={estilos.listaPasos}
                accessibilityLabel={`Pasos de la ruta: ${pasos.length}`}
              >
                {pasos.map((paso, indice) => {
                  const activoPaso = indice === indicePaso;
                  return (
                    <Pressable
                      key={`${indice}-${paso.tipo}`}
                      onPress={() => setIndicePaso(indice)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activoPaso }}
                      accessibilityLabel={`Paso ${indice + 1} de ${pasos.length}: ${paso.instruccion}. ${formatearDistancia(Math.max(paso.distanciaKm, 0))}.`}
                      style={[
                        estilos.tarjetaPaso,
                        activoPaso ? estilos.tarjetaPasoActiva : null,
                      ]}
                    >
                      <Ionicons
                        name={iconoDeManeuver(paso.tipo)}
                        size={20}
                        color={activoPaso ? colors.white : colors.primary}
                      />
                      <Text
                        style={[
                          estilos.textoPaso,
                          activoPaso ? estilos.textoPasoActivo : null,
                        ]}
                        numberOfLines={2}
                      >
                        {paso.instruccion}
                      </Text>
                      <Text
                        style={[
                          estilos.distanciaPaso,
                          activoPaso ? estilos.textoPasoActivo : null,
                        ]}
                      >
                        {formatearDistancia(Math.max(paso.distanciaKm, 0))}
                      </Text>
                    </Pressable>
                  );
                })}
                {pasos.length === 0 ? (
                  <Text style={estilos.textoVacio}>
                    El motor no devolvió pasos detallados: guíate por el
                    trayecto dibujado en el mapa.
                  </Text>
                ) : null}
              </ScrollView>

              {rutaMostrada?.advertencias?.length ? (
                <View style={estilos.avisoAdvertencias}>
                  {rutaMostrada.advertencias.map((advertencia) => (
                    <View key={advertencia} style={estilos.filaAviso}>
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

              <AppButton
                titulo="Finalizar ruta"
                variante="peligro"
                icono="stop-circle-outline"
                onPress={() => navigation.goBack()}
                pistaAccesibilidad="Cierra la navegación paso a paso y vuelve al mapa"
              />
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  encabezadoSeguro: {
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  barraNavegacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  botonAtras: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: {
    flex: 1,
  },
  botonGuia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  botonGuiaActivo: {
    backgroundColor: colors.primary,
  },
  textoGuia: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  textoGuiaActivo: {
    color: colors.white,
  },
  tarjetaManiobra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    ...shadow.card,
  },
  textosManiobra: {
    flex: 1,
    gap: 2,
  },
  instruccionGrande: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
    lineHeight: 24,
  },
  distanciaManiobra: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primarySoft,
  },
  botonSiguiente: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapa: {
    flex: 1,
    // El mapa nunca baja de media pantalla (devolución del equipo: la hoja
    // inferior le robaba espacio); la hoja cede y su contenido se desplaza.
    minHeight: '50%',
    backgroundColor: '#E8EEF4',
  },
  cargando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  textoCargando: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  hoja: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    // Cede altura a favor del mapa cuando el contenido no cabe entero:
    // el ScrollView interno permite desplazar el resto (issue del equipo).
    flexShrink: 1,
    ...shadow.card,
  },
  contenidoHoja: {
    gap: spacing.sm,
  },
  filaEstadisticas: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  estadistica: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 80,
  },
  separadorVertical: {
    width: 1,
    backgroundColor: colors.border,
  },
  etiquetaEstadistica: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  valorEstadistica: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  selloEscalones: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  selloEscalonesAviso: {
    backgroundColor: colors.warningSoft,
  },
  tituloSello: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  detalleSello: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  filaSellos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  textoSello: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  listaPasos: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tarjetaPaso: {
    width: 170,
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tarjetaPasoActiva: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  textoPaso: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    lineHeight: 17,
    minHeight: 34,
  },
  textoPasoActivo: {
    color: colors.white,
  },
  distanciaPaso: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  textoVacio: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: 260,
  },
  avisoDatos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  avisoAdvertencias: {
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
  bloqueExito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  textoExito: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.success,
    lineHeight: 18,
  },
  tarjetaError: {
    backgroundColor: colors.dangerSoft,
    shadowOpacity: 0,
    elevation: 0,
    gap: spacing.sm,
  },
  filaAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textoError: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.danger,
    lineHeight: 20,
  },
});
