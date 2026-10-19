import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Fragment, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { AvisoSinConexion } from '../components/AvisoSinConexion';
import { Badge } from '../components/Badge';
import { EncabezadoMarca } from '../components/EncabezadoMarca';
import { CampoTexto } from '../components/CampoTexto';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ToggleRow } from '../components/ToggleRow';
import type { MainTabParamList } from '../navigation/types';
import {
  capturarFoto,
  subirEvidencia,
  type FotoCapturada,
  type OrigenFoto,
} from '../services/evidencias';
import { crearReporte, ReporteError } from '../services/reportes';
import type { IconName } from '../services/types';
import { usePoisStore } from '../store/poisStore';
import {
  alternarEtiquetaRapida,
  BORRADOR_INICIAL,
  construirCaracteristicas,
  contarValoresRespondidos,
  estaEtiquetaElegida,
  ETIQUETAS_RAPIDAS,
  TIPOS_POI,
  validarPasoDetalles,
  validarPasoUbicacion,
  type BorradorReporte,
  type EtiquetaRapida,
  type ValorBorrador,
} from '../utils/reporteValidacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

type Paso = 1 | 2 | 3 | 4;

const PASOS: Paso[] = [1, 2, 3, 4];

const TITULOS_PASO: Record<Paso, string> = {
  1: 'Tipo de reporte',
  2: 'Ubicación',
  3: 'Detalles',
  4: 'Confirmación',
};

/** Encabezado editorial de cada paso (mockups U09/U10). */
const ENCABEZADO_PASO: Record<
  Paso,
  { icono: IconName; kicker: string; titulo: string; subtitulo: string }
> = {
  1: {
    icono: 'document-text-outline',
    kicker: 'Reportar infraestructura',
    titulo: '¿Qué deseas reportar?',
    subtitulo:
      'Tu aporte ayuda a una comunidad de viajeros a tener experiencias más seguras y accesibles.',
  },
  2: {
    icono: 'location-sharp',
    kicker: 'Ubicación del lugar',
    titulo: '¿Dónde está?',
    subtitulo:
      'Confirma dónde está el lugar: usa tu GPS, escríbelo abajo o ajústalo manualmente.',
  },
  3: {
    icono: 'document-text-outline',
    kicker: 'Detalles del aporte',
    titulo: 'Añade más detalles',
    subtitulo:
      'Cuéntanos más sobre lo que encontraste. Esta información ayuda a otros viajeros a tomar mejores decisiones.',
  },
  4: {
    icono: 'checkmark-circle-outline',
    kicker: 'Revisa antes de enviar',
    titulo: 'Confirma tu reporte',
    subtitulo:
      'Verifica que la información sea correcta antes de enviarla a la comunidad.',
  },
};

/** Límite del texto libre del aporte (contador visible en el paso Detalles). */
const MAX_DESCRIPCION = 500;

/** Paleta de las etiquetas rápidas (mockup U10): rojo=negativo, verde=positivo. */
const PALETA_TONO = {
  peligro: { fondo: colors.dangerSoft, tema: colors.danger },
  alerta: { fondo: colors.warningSoft, tema: colors.warning },
  exito: { fondo: colors.successSoft, tema: colors.success },
} as const;

interface ResultadoEnvio {
  idPoi: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  descripcion: string;
  esCritico: boolean;
  fotoUri?: string;
  avisoFoto?: string;
}

/** Lista de errores del paso (región viva del lector de pantalla). */
function ListaErrores({ errores }: { errores: string[] }) {
  if (errores.length === 0) {
    return null;
  }
  return (
    <View style={estilos.errores} accessibilityLiveRegion="polite">
      {errores.map((error) => (
        <View key={error} style={estilos.filaError}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={estilos.textoError}>{error}</Text>
        </View>
      ))}
    </View>
  );
}

/** Barra de 4 pasos: círculos completados/activo/pendiente + conectores. */
function BarraPasos({ paso }: { paso: Paso }) {
  return (
    <View
      style={estilos.pasos}
      accessible
      accessibilityLabel={`Paso ${paso} de ${PASOS.length}: ${TITULOS_PASO[paso]}`}
    >
      <View style={estilos.pasosFila}>
        {PASOS.map((numero) => {
          const completado = numero < paso;
          return (
            <Fragment key={numero}>
              {numero > 1 ? (
                <View
                  style={[
                    estilos.pasoLinea,
                    completado ? estilos.pasoLineaActiva : null,
                  ]}
                />
              ) : null}
              <View
                style={[
                  estilos.pasoCirculo,
                  numero === paso ? estilos.pasoCirculoActivo : null,
                  completado ? estilos.pasoCirculoCompleto : null,
                ]}
              >
                {completado ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      estilos.pasoNumero,
                      numero === paso ? estilos.pasoNumeroActivo : null,
                    ]}
                  >
                    {numero}
                  </Text>
                )}
              </View>
            </Fragment>
          );
        })}
      </View>
      <View style={estilos.pasosEtiquetas}>
        {PASOS.map((numero) => (
          <Text
            key={numero}
            style={[
              estilos.pasoEtiqueta,
              numero === paso ? estilos.pasoEtiquetaActiva : null,
            ]}
          >
            {TITULOS_PASO[numero]}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Etiqueta rápida del paso Detalles: pastilla con casilla visual de tono. */
function EtiquetaChip({
  etiqueta,
  activa,
  onPress,
}: {
  etiqueta: EtiquetaRapida;
  activa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="checkbox"
      accessibilityLabel={etiqueta.etiqueta}
      accessibilityState={{ checked: activa }}
      style={({ pressed }) => [
        estilos.etiquetaChip,
        { backgroundColor: PALETA_TONO[etiqueta.tono].fondo },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <Ionicons
        name={activa ? 'checkmark-circle' : 'ellipse'}
        size={16}
        color={PALETA_TONO[etiqueta.tono].tema}
      />
      <Text style={estilos.etiquetaTexto} numberOfLines={2}>
        {etiqueta.etiqueta}
      </Text>
    </Pressable>
  );
}

/**
 * U09/U10 — Crear reporte colaborativo en 4 pasos:
 *   1. Tipo de reporte (lugar accesible o barrera/obstáculo).
 *   2. Ubicación: lugar nuevo o existente + GPS/coordenadas.
 *   3. Detalles: descripción, etiquetas rápidas y foto de evidencia.
 *   4. Confirmación: resumen y envío.
 *
 * Al enviar, la RPC `crear_reporte` crea el reporte en estado pendiente: con
 * 3 confirmaciones independientes la comunidad publica el punto (Proceso 1).
 * Las etiquetas rápidas fijan valores de características del catálogo, así
 * que viajan dentro del mismo envío (`construirCaracteristicas`) sin RPCs
 * nuevas.
 */
export function ContributeScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, 'Contribuir'>>();
  const pois = usePoisStore((estado) => estado.pois);
  const catalogo = usePoisStore((estado) => estado.catalogo);
  const fuente = usePoisStore((estado) => estado.fuente);
  const cargarPois = usePoisStore((estado) => estado.cargar);

  const [paso, setPaso] = useState<Paso>(1);
  const [tipoElegido, setTipoElegido] = useState(false);
  const [borrador, setBorrador] = useState<BorradorReporte>(BORRADOR_INICIAL);
  const [busquedaPoi, setBusquedaPoi] = useState('');
  const [foto, setFoto] = useState<FotoCapturada | null>(null);
  const [erroresPaso, setErroresPaso] = useState<string[]>([]);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [ubicacionCargando, setUbicacionCargando] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null);

  const actualizarBorrador = (parcial: Partial<BorradorReporte>) => {
    setBorrador((anterior) => ({ ...anterior, ...parcial }));
  };

  const actualizarValor = (id: string, valor: ValorBorrador) => {
    setBorrador((anterior) => ({
      ...anterior,
      valores: { ...anterior.valores, [id]: valor },
    }));
  };

  const cambiaEtiqueta = (etiqueta: EtiquetaRapida) => {
    setBorrador((anterior) => ({
      ...anterior,
      valores: alternarEtiquetaRapida(anterior.valores, etiqueta),
    }));
  };

  /** Etiquetas válidas para el catálogo vigente de la BD. */
  const etiquetasVisibles = useMemo(() => {
    const ids = new Set(catalogo.map((caracteristica) => caracteristica.id));
    return ETIQUETAS_RAPIDAS.filter((etiqueta) =>
      ids.has(etiqueta.caracteristicaId),
    );
  }, [catalogo]);

  const poiSeleccionado = borrador.poiId
    ? pois.find((poi) => poi.id === borrador.poiId)
    : undefined;

  const poisFiltrados = busquedaPoi.trim()
    ? pois.filter((poi) =>
        poi.nombre.toLowerCase().includes(busquedaPoi.trim().toLowerCase()),
      )
    : pois;

  const anunciar = (mensaje: string) => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(mensaje);
    }
  };

  const continuar = () => {
    let errores: string[] = [];
    if (paso === 1) {
      if (!tipoElegido) {
        errores = [
          'Elige si quieres reportar un lugar accesible o una barrera.',
        ];
      }
    } else if (paso === 2) {
      errores = validarPasoUbicacion(borrador);
    } else if (paso === 3) {
      errores = validarPasoDetalles(borrador);
    }
    setErroresPaso(errores);
    if (errores.length > 0) {
      anunciar('Hay errores en el formulario. Revisa los campos marcados.');
      return;
    }
    setPaso((anterior) => (anterior + 1) as Paso);
  };

  const retroceder = () => {
    setErroresPaso([]);
    setErrorEnvio(null);
    setPaso((anterior) => Math.max(1, anterior - 1) as Paso);
  };

  const elegirTipo = (esBarrera: boolean) => {
    actualizarBorrador({ esCritico: esBarrera });
    setTipoElegido(true);
  };

  const capturarUbicacion = async () => {
    setUbicacionCargando(true);
    setErrorUbicacion(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorUbicacion(
          'Sin permiso de ubicación. Actívalo en los ajustes del teléfono o escríbela abajo.',
        );
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({});
      actualizarBorrador({
        lat: posicion.coords.latitude,
        lon: posicion.coords.longitude,
      });
      anunciar('Ubicación capturada.');
    } catch {
      setErrorUbicacion(
        'No pudimos obtener tu ubicación. Inténtalo de nuevo o escríbela abajo.',
      );
    } finally {
      setUbicacionCargando(false);
    }
  };

  const manejarFoto = async (origen: OrigenFoto) => {
    setErrorFoto(null);
    try {
      const capturada = await capturarFoto(origen);
      if (capturada) {
        setFoto(capturada);
        anunciar('Foto lista para adjuntar.');
      }
    } catch (error) {
      setErrorFoto((error as Error).message);
    }
  };

  const enviar = async () => {
    if (fuente !== 'backend') {
      setErrorEnvio(
        'Sin conexión con la base de datos: toca Reintentar arriba y vuelve a enviar.',
      );
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      // La evidencia se sube primero; si falla, el reporte viaja sin foto
      // (degradación con gracia, RNF-19).
      let storageKey: string | null = null;
      let avisoFoto: string | undefined;
      if (foto) {
        try {
          const subida = await subirEvidencia(foto);
          storageKey = subida.storageKey;
        } catch (error) {
          avisoFoto = `${(error as Error).message} El reporte se envió sin foto.`;
        }
      }

      const creado = await crearReporte({
        poiId: borrador.modo === 'actualizacion' ? borrador.poiId : null,
        nombre: borrador.modo === 'nuevo' ? borrador.nombre.trim() : undefined,
        tipoPoi: borrador.modo === 'nuevo' ? borrador.tipoPoi : undefined,
        direccion: borrador.direccion.trim() || undefined,
        lat: borrador.lat ?? undefined,
        lon: borrador.lon ?? undefined,
        descripcion: borrador.descripcion.trim(),
        esCritico: borrador.esCritico,
        caracteristicas: construirCaracteristicas(catalogo, borrador.valores),
        evidenciaStorageKey: storageKey,
      });

      // Refresca el mapa/ficha para que el nuevo punto pendiente ya figure.
      void cargarPois();

      setResultado({
        idPoi: creado.idPoi,
        nombre:
          borrador.modo === 'nuevo'
            ? borrador.nombre.trim()
            : (poiSeleccionado?.nombre ?? 'el lugar'),
        direccion:
          borrador.direccion.trim() ||
          (poiSeleccionado?.direccion ?? 'Sin dirección registrada'),
        ciudad: poiSeleccionado?.ciudad ?? 'Armenia, Quindío',
        descripcion: borrador.descripcion.trim(),
        esCritico: borrador.esCritico,
        fotoUri: foto?.uri,
        avisoFoto,
      });
      anunciar('Reporte enviado. Queda pendiente de validación comunitaria.');
    } catch (error) {
      const mensaje =
        error instanceof ReporteError
          ? error.message
          : 'No pudimos enviar el reporte. Revisa tu conexión e inténtalo de nuevo.';
      setErrorEnvio(mensaje);
      anunciar(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setPaso(1);
    setTipoElegido(false);
    setBorrador(BORRADOR_INICIAL);
    setBusquedaPoi('');
    setFoto(null);
    setErroresPaso([]);
    setErrorUbicacion(null);
    setErrorFoto(null);
    setErrorEnvio(null);
    setResultado(null);
  };

  // ---------------------------------------------------------------------------
  // Éxito: el reporte entró a validación comunitaria (mockup de confirmación)
  // ---------------------------------------------------------------------------
  if (resultado) {
    return (
      <SafeAreaView style={estilos.pantalla} edges={['top']}>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <View style={estilos.exitoCabecera}>
            <View style={estilos.exitoCirculo}>
              <Ionicons name="checkmark" size={60} color={colors.white} />
            </View>
            <Text style={estilos.tituloExito} accessibilityRole="header">
              ¡Reporte enviado con éxito!
            </Text>
            <Text style={estilos.textoExito}>
              Tu aporte ha sido recibido. Para garantizar la fiabilidad,
              aparecerá en el mapa público cuando alcance 3 confirmaciones de la
              comunidad.
            </Text>
          </View>

          <Card estilo={estilos.tarjetaExitoResumen}>
            <Text style={estilos.tituloCard} accessibilityRole="header">
              Resumen de tu reporte
            </Text>

            {resultado.fotoUri ? (
              <Image
                source={{ uri: resultado.fotoUri }}
                style={estilos.fotoResumen}
                accessibilityRole="image"
                accessibilityLabel="Foto de evidencia de tu reporte"
                accessibilityIgnoresInvertColors
              />
            ) : null}

            <View style={estilos.filaResumen}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <View style={estilos.textosResumen}>
                <Text style={estilos.valorResumen}>{resultado.direccion}</Text>
                <Text style={estilos.detalleResumen}>{resultado.ciudad}</Text>
              </View>
            </View>

            <View style={estilos.filaResumen}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={colors.primary}
              />
              <View style={estilos.textosResumen}>
                <Text style={estilos.etiquetaLinea}>Tipo de reporte</Text>
                <Badge
                  tono={resultado.esCritico ? 'alerta' : 'exito'}
                  texto={
                    resultado.esCritico
                      ? 'Barrera / Obstáculo'
                      : 'Lugar accesible'
                  }
                />
              </View>
            </View>

            <View style={estilos.filaResumen}>
              <Ionicons
                name="chatbox-outline"
                size={18}
                color={colors.primary}
              />
              <View style={estilos.textosResumen}>
                <Text style={estilos.etiquetaLinea}>Descripción</Text>
                <Text style={estilos.valorResumen} numberOfLines={4}>
                  {resultado.descripcion || 'Sin descripción.'}
                </Text>
              </View>
            </View>

            <View style={estilos.filaResumen}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <View style={estilos.textosResumen}>
                <Text style={estilos.valorResumen}>
                  En revisión por la comunidad
                </Text>
                <Text style={estilos.detalleResumen}>
                  Necesita 3 confirmaciones para ser visible en el mapa.
                </Text>
              </View>
            </View>
          </Card>

          {resultado.avisoFoto ? (
            <View style={estilos.aviso} accessibilityLiveRegion="polite">
              <Ionicons
                name="warning-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={estilos.textoAviso}>{resultado.avisoFoto}</Text>
            </View>
          ) : null}

          <AppButton
            titulo="Volver al mapa"
            icono="map-outline"
            onPress={() => {
              const idPoi = resultado.idPoi;
              reiniciar();
              navigation.navigate('Mapa', { destinoPoiId: idPoi });
            }}
          />

          <View style={estilos.filaGracias}>
            <Ionicons name="people" size={22} color={colors.primary} />
            <View style={estilos.textosGracias}>
              <Text style={estilos.tituloGracias}>
                ¡Gracias por contribuir!
              </Text>
              <Text style={estilos.textoGracias}>
                Juntos construimos un turismo más accesible e inclusivo.
              </Text>
            </View>
          </View>

          <AppButton
            titulo="Crear otro reporte"
            variante="fantasma"
            icono="add-circle-outline"
            onPress={reiniciar}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Wizard de 4 pasos
  // ---------------------------------------------------------------------------
  const encabezadoPaso = ENCABEZADO_PASO[paso];
  const respondidas = contarValoresRespondidos(borrador.valores);

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <EncabezadoMarca
          tamanoLogo={40}
          textoAtras="Atrás"
          onAtras={paso > 1 ? retroceder : () => navigation.navigate('Inicio')}
        />

        <BarraPasos paso={paso} />

        <AvisoSinConexion titulo="Sin conexión con la base de datos: los reportes no se pueden enviar hasta reconectar." />

        <View style={estilos.encabezadoPaso}>
          <View style={estilos.kickerFila}>
            <Ionicons
              name={encabezadoPaso.icono}
              size={22}
              color={colors.primary}
            />
            <Text style={estilos.kicker}>{encabezadoPaso.kicker}</Text>
          </View>
          <Text style={estilos.tituloPaso} accessibilityRole="header">
            {encabezadoPaso.titulo}
          </Text>
          <Text style={estilos.subtituloPaso}>{encabezadoPaso.subtitulo}</Text>
        </View>

        {/* ------------------------------ PASO 1 ------------------------------ */}
        {paso === 1 ? (
          <>
            <Pressable
              onPress={() => elegirTipo(false)}
              accessibilityRole="radio"
              accessibilityState={{
                selected: tipoElegido && !borrador.esCritico,
              }}
              accessibilityHint="Reporta un lugar que cuenta con condiciones de accesibilidad para todas las personas"
              style={[
                estilos.tarjetaTipo,
                estilos.tarjetaTipoAccesible,
                tipoElegido && !borrador.esCritico
                  ? estilos.tarjetaTipoActiva
                  : null,
              ]}
            >
              <View style={estilos.iconoTipoAccesible}>
                <Ionicons name="accessibility" size={26} color={colors.white} />
              </View>
              <View style={estilos.textosTipo}>
                <Text style={estilos.tituloTipoAccesible}>Lugar Accesible</Text>
                <Text style={estilos.textoTipo}>
                  Reporta un lugar que cuenta con condiciones de accesibilidad
                  para todas las personas.
                </Text>
                <View style={estilos.chipInterno}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.success}
                  />
                  <Text style={estilos.textoChipInterno}>
                    Ayuda a que más personas lo encuentren
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={colors.success}
              />
            </Pressable>

            <Pressable
              onPress={() => elegirTipo(true)}
              accessibilityRole="radio"
              accessibilityState={{
                selected: tipoElegido && borrador.esCritico,
              }}
              accessibilityHint="Reporta una barrera u obstáculo que dificulte la movilidad o el acceso en un lugar"
              style={[
                estilos.tarjetaTipo,
                estilos.tarjetaTipoBarrera,
                tipoElegido && borrador.esCritico
                  ? estilos.tarjetaTipoActiva
                  : null,
              ]}
            >
              <View style={estilos.iconoTipoBarrera}>
                <Ionicons name="warning" size={26} color={colors.white} />
              </View>
              <View style={estilos.textosTipo}>
                <Text style={estilos.tituloTipoBarrera}>
                  Barrera / Obstáculo
                </Text>
                <Text style={estilos.textoTipo}>
                  Reporta una barrera u obstáculo que dificulte la movilidad o
                  el acceso en un lugar.
                </Text>
                <View style={estilos.chipInterno}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={colors.danger}
                  />
                  <Text style={estilos.textoChipInterno}>
                    Contribuye a alertar a otros viajeros
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={colors.warning}
              />
            </Pressable>

            <ListaErrores errores={erroresPaso} />
            <AppButton
              titulo="Continuar"
              iconoFinal="arrow-forward"
              onPress={continuar}
            />
          </>
        ) : null}

        {/* ------------------------------ PASO 2 ------------------------------ */}
        {paso === 2 ? (
          <>
            <View style={estilos.seccion}>
              <Text style={estilos.tituloBloque}>¿Cómo lo reportas?</Text>
              <View style={estilos.filaOpciones}>
                <Pressable
                  onPress={() =>
                    actualizarBorrador({ modo: 'nuevo', poiId: null })
                  }
                  accessibilityRole="radio"
                  accessibilityState={{ selected: borrador.modo === 'nuevo' }}
                  accessibilityHint="Un lugar que todavía no aparece en el mapa"
                  style={[
                    estilos.opcion,
                    borrador.modo === 'nuevo' ? estilos.opcionActiva : null,
                  ]}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color={
                      borrador.modo === 'nuevo'
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text style={estilos.opcionTitulo}>Un lugar nuevo</Text>
                  <Text style={estilos.opcionDescripcion}>
                    Aún no aparece en el mapa
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => actualizarBorrador({ modo: 'actualizacion' })}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: borrador.modo === 'actualizacion',
                  }}
                  accessibilityHint="Corrige o amplía los datos de un lugar del mapa"
                  style={[
                    estilos.opcion,
                    borrador.modo === 'actualizacion'
                      ? estilos.opcionActiva
                      : null,
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={22}
                    color={
                      borrador.modo === 'actualizacion'
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text style={estilos.opcionTitulo}>Actualizar un lugar</Text>
                  <Text style={estilos.opcionDescripcion}>
                    Ya está en el mapa
                  </Text>
                </Pressable>
              </View>
            </View>

            {borrador.modo === 'nuevo' ? (
              <View style={estilos.seccion}>
                <CampoTexto
                  etiqueta="Nombre del lugar"
                  icono="business-outline"
                  placeholder="Ej.: Centro Cultural del Café"
                  value={borrador.nombre}
                  onChangeText={(nombre) => actualizarBorrador({ nombre })}
                  autoCapitalize="words"
                />
                <View>
                  <Text style={estilos.etiquetaGrupo}>Tipo de lugar</Text>
                  <View style={estilos.chips}>
                    {TIPOS_POI.map((tipo) => (
                      <Chip
                        key={tipo.valor}
                        etiqueta={tipo.etiqueta}
                        seleccionado={borrador.tipoPoi === tipo.valor}
                        onPress={() =>
                          actualizarBorrador({ tipoPoi: tipo.valor })
                        }
                      />
                    ))}
                  </View>
                </View>
                <CampoTexto
                  etiqueta="Dirección (opcional)"
                  icono="location-outline"
                  placeholder="Calle 12 # 4-56"
                  value={borrador.direccion}
                  onChangeText={(direccion) =>
                    actualizarBorrador({ direccion })
                  }
                  autoCapitalize="sentences"
                />
              </View>
            ) : (
              <View style={estilos.seccion}>
                <CampoTexto
                  etiqueta="Buscar el lugar"
                  icono="search-outline"
                  placeholder="Escribe el nombre del lugar"
                  value={busquedaPoi}
                  onChangeText={setBusquedaPoi}
                  autoCapitalize="none"
                />
                {poisFiltrados.length === 0 ? (
                  <Text style={estilos.textoSecundario}>
                    No encontramos lugares con ese nombre.
                  </Text>
                ) : (
                  poisFiltrados.slice(0, 6).map((poi) => {
                    const activo = borrador.poiId === poi.id;
                    return (
                      <Pressable
                        key={poi.id}
                        onPress={() => actualizarBorrador({ poiId: poi.id })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: activo }}
                        accessibilityLabel={`${poi.nombre}, ${poi.categoria}`}
                        style={[
                          estilos.filaLugar,
                          activo ? estilos.filaLugarActiva : null,
                        ]}
                      >
                        <View style={estilos.textosLugar}>
                          <Text style={estilos.nombreLugar}>{poi.nombre}</Text>
                          <Text style={estilos.detalleLugar}>
                            {poi.categoria} · {poi.direccion}
                          </Text>
                        </View>
                        <Ionicons
                          name={activo ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={activo ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}

            <View style={estilos.seccion}>
              <Text style={estilos.tituloBloque}>Ubicación en el mapa</Text>
              {borrador.modo === 'actualizacion' && poiSeleccionado ? (
                <Card estilo={estilos.tarjetaSuave}>
                  <View style={estilos.filaAviso}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={estilos.textoAviso}>
                      Usaremos la ubicación registrada de «
                      {poiSeleccionado.nombre}».
                    </Text>
                  </View>
                </Card>
              ) : (
                <>
                  <AppButton
                    titulo={
                      borrador.lat !== null
                        ? 'Actualizar mi ubicación'
                        : 'Usar mi ubicación actual'
                    }
                    variante="contorno"
                    icono="navigate-outline"
                    cargando={ubicacionCargando}
                    onPress={() => void capturarUbicacion()}
                  />
                  {borrador.lat !== null && borrador.lon !== null ? (
                    <Text style={estilos.textoExitoPequeno}>
                      Ubicación capturada: {borrador.lat.toFixed(5)},{' '}
                      {borrador.lon.toFixed(5)}
                    </Text>
                  ) : null}
                  {errorUbicacion ? (
                    <Text
                      style={estilos.textoError}
                      accessibilityLiveRegion="polite"
                    >
                      {errorUbicacion}
                    </Text>
                  ) : null}
                  <View style={estilos.filaCoordenadas}>
                    <View style={estilos.campoMitad}>
                      <CampoTexto
                        etiqueta="Latitud"
                        icono="pin-outline"
                        placeholder="4.53389"
                        value={
                          borrador.lat !== null ? String(borrador.lat) : ''
                        }
                        onChangeText={(texto) =>
                          actualizarBorrador({
                            lat:
                              texto.trim() === ''
                                ? null
                                : Number(texto.replace(',', '.')),
                          })
                        }
                        keyboardType="decimal-pad"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={estilos.campoMitad}>
                      <CampoTexto
                        etiqueta="Longitud"
                        icono="pin-outline"
                        placeholder="-75.68111"
                        value={
                          borrador.lon !== null ? String(borrador.lon) : ''
                        }
                        onChangeText={(texto) =>
                          actualizarBorrador({
                            lon:
                              texto.trim() === ''
                                ? null
                                : Number(texto.replace(',', '.')),
                          })
                        }
                        keyboardType="decimal-pad"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </>
              )}
            </View>

            <ListaErrores errores={erroresPaso} />
            <View style={estilos.filaBotones}>
              <View style={estilos.botonMitad}>
                <AppButton
                  titulo="Atrás"
                  variante="contorno"
                  icono="arrow-back-outline"
                  onPress={retroceder}
                />
              </View>
              <View style={estilos.botonMitad}>
                <AppButton
                  titulo="Continuar"
                  iconoFinal="arrow-forward"
                  onPress={continuar}
                />
              </View>
            </View>
          </>
        ) : null}

        {/* ------------------------------ PASO 3 ------------------------------ */}
        {paso === 3 ? (
          <>
            <View style={estilos.seccion}>
              <TextoCampoContador
                etiqueta={
                  borrador.esCritico
                    ? 'Describe la barrera o el acceso'
                    : 'Describe el acceso del lugar'
                }
                placeholder="Ej. La rampa es muy inclinada y no tiene pasamanos…"
                value={borrador.descripcion}
                onChange={(descripcion) =>
                  actualizarBorrador({
                    descripcion: descripcion.slice(0, MAX_DESCRIPCION),
                  })
                }
              />
            </View>

            <View style={estilos.seccion}>
              <View style={estilos.kickerFila}>
                <Ionicons name="pricetag" size={18} color={colors.primary} />
                <Text style={estilos.tituloBloque}>Etiquetas rápidas</Text>
              </View>
              <Text style={estilos.textoSecundario}>
                Selecciona una o más opciones que mejor describan la situación.
                Marcan los datos de accesibilidad que viajan con tu reporte.
              </Text>
              <View style={estilos.chipsEtiquetas}>
                {etiquetasVisibles.map((etiqueta) => (
                  <EtiquetaChip
                    key={etiqueta.id}
                    etiqueta={etiqueta}
                    activa={estaEtiquetaElegida(borrador.valores, etiqueta)}
                    onPress={() => cambiaEtiqueta(etiqueta)}
                  />
                ))}
              </View>
            </View>

            <View style={estilos.seccion}>
              <Text style={estilos.tituloBloque}>
                Foto de evidencia (opcional)
              </Text>
              {foto ? (
                <>
                  <Image
                    source={{ uri: foto.uri }}
                    style={estilos.vistaFoto}
                    accessibilityRole="image"
                    accessibilityLabel="Foto de evidencia capturada"
                    accessibilityIgnoresInvertColors
                  />
                  <AppButton
                    titulo="Quitar foto"
                    variante="fantasma"
                    icono="trash-outline"
                    onPress={() => setFoto(null)}
                  />
                </>
              ) : (
                <>
                  <AppButton
                    titulo="Tomar foto"
                    variante="contorno"
                    icono="camera-outline"
                    onPress={() => void manejarFoto('camara')}
                  />
                  <AppButton
                    titulo="Elegir de la galería"
                    variante="contorno"
                    icono="images-outline"
                    onPress={() => void manejarFoto('galeria')}
                  />
                </>
              )}
              <Text style={estilos.textoSecundario}>
                Máximo 5 MB (JPG, PNG o WebP). Si la subida falla, el reporte se
                envía igual sin foto.
              </Text>
              {errorFoto ? (
                <Text
                  style={estilos.textoError}
                  accessibilityLiveRegion="polite"
                >
                  {errorFoto}
                </Text>
              ) : null}
            </View>

            <View style={estilos.seccion}>
              <Text style={estilos.tituloBloque}>
                Características del lugar
              </Text>
              <Text style={estilos.textoSecundario}>
                {respondidas} de {catalogo.length} respondidas. Completa lo que
                sepas: estos datos sincronizan con las etiquetas rápidas y
                alimentan los filtros del mapa.
              </Text>
              {catalogo.map((caracteristica) => {
                const actual = borrador.valores[caracteristica.id] ?? {};
                if (caracteristica.tipoValor === 'BOOLEANO') {
                  return (
                    <ToggleRow
                      key={caracteristica.id}
                      etiqueta={caracteristica.nombre}
                      descripcion={caracteristica.descripcion}
                      valor={actual.booleano ?? false}
                      onCambio={(valor) =>
                        actualizarValor(caracteristica.id, {
                          ...actual,
                          booleano: valor,
                        })
                      }
                    />
                  );
                }
                if (caracteristica.tipoValor === 'NUMERICO') {
                  return (
                    <CampoTexto
                      key={caracteristica.id}
                      etiqueta={
                        caracteristica.unidad
                          ? `${caracteristica.nombre} (${caracteristica.unidad})`
                          : caracteristica.nombre
                      }
                      icono={caracteristica.icono}
                      placeholder="Ej. 90"
                      value={actual.numerico ?? ''}
                      onChangeText={(texto) =>
                        actualizarValor(caracteristica.id, {
                          ...actual,
                          numerico: texto,
                        })
                      }
                      keyboardType="numeric"
                      autoComplete="off"
                    />
                  );
                }
                return (
                  <CampoTexto
                    key={caracteristica.id}
                    etiqueta={caracteristica.nombre}
                    icono={caracteristica.icono}
                    placeholder="Escribe un detalle"
                    value={actual.texto ?? ''}
                    onChangeText={(texto) =>
                      actualizarValor(caracteristica.id, { ...actual, texto })
                    }
                    autoComplete="off"
                  />
                );
              })}
            </View>

            <ListaErrores errores={erroresPaso} />
            <View style={estilos.filaBotones}>
              <View style={estilos.botonMitad}>
                <AppButton
                  titulo="Atrás"
                  variante="contorno"
                  icono="arrow-back-outline"
                  onPress={retroceder}
                />
              </View>
              <View style={estilos.botonMitad}>
                <AppButton
                  titulo="Continuar a confirmación"
                  iconoFinal="arrow-forward"
                  onPress={continuar}
                />
              </View>
            </View>
          </>
        ) : null}

        {/* ------------------------------ PASO 4 ------------------------------ */}
        {paso === 4 ? (
          <>
            <View style={estilos.seccion}>
              <Text style={estilos.tituloBloque}>Resumen</Text>
              <Card estilo={estilos.tarjetaSuave}>
                <Text style={estilos.lineaResumen}>
                  <Text style={estilos.etiquetaResumen}>Lugar: </Text>
                  <Text style={estilos.textoResumen}>
                    {borrador.modo === 'nuevo'
                      ? borrador.nombre.trim()
                      : (poiSeleccionado?.nombre ?? 'Sin seleccionar')}
                  </Text>
                </Text>
                <Text style={estilos.lineaResumen}>
                  <Text style={estilos.etiquetaResumen}>Tipo de reporte: </Text>
                  {borrador.esCritico
                    ? 'Barrera u obstáculo (revisión prioritaria)'
                    : 'Lugar accesible'}
                </Text>
                <Text style={estilos.lineaResumen}>
                  <Text style={estilos.etiquetaResumen}>Ubicación: </Text>
                  {borrador.modo === 'actualizacion'
                    ? 'La registrada del lugar'
                    : borrador.lat !== null && borrador.lon !== null
                      ? `${borrador.lat.toFixed(5)}, ${borrador.lon.toFixed(5)}`
                      : 'Sin capturar'}
                </Text>
                <Text style={estilos.lineaResumen}>
                  <Text style={estilos.etiquetaResumen}>Evidencia: </Text>
                  {foto ? 'Foto adjunta' : 'Sin foto'}
                </Text>
                <Text style={estilos.lineaResumen}>
                  <Text style={estilos.etiquetaResumen}>
                    Datos de accesibilidad:{' '}
                  </Text>
                  {respondidas} de {catalogo.length} respondidas
                </Text>
              </Card>
              <Text style={estilos.textoSecundario}>
                Tu reporte entrará en validación comunitaria: con 3
                confirmaciones de otros viajeros se publicará en el mapa.
              </Text>
            </View>

            {errorEnvio ? (
              <View style={estilos.avisoError} accessibilityLiveRegion="polite">
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={estilos.textoError}>{errorEnvio}</Text>
              </View>
            ) : null}

            <View style={estilos.filaBotones}>
              <View style={estilos.botonMitad}>
                <AppButton
                  titulo="Atrás"
                  variante="contorno"
                  icono="arrow-back-outline"
                  onPress={retroceder}
                  deshabilitado={enviando}
                />
              </View>
              <View style={estilos.botonMitad}>
                <AppButton
                  titulo="Enviar a la comunidad"
                  icono="paper-plane-outline"
                  cargando={enviando}
                  deshabilitado={enviando}
                  onPress={() => void enviar()}
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Campo con contenedor propio y contador «n/500» (mockup del paso Detalles).
 */
function TextoCampoContador({
  etiqueta,
  placeholder,
  value,
  onChange,
}: {
  etiqueta: string;
  placeholder: string;
  value: string;
  onChange: (texto: string) => void;
}) {
  return (
    <View style={estilos.contenedorDescripcion}>
      <Text style={estilos.etiquetaDescripcion}>{etiqueta}</Text>
      <View style={estilos.cajaDescripcion}>
        <Ionicons
          name="chatbox-outline"
          size={18}
          color={colors.textSecondary}
          style={estilos.iconoMultilineaDescripcion}
        />
        <TextInput
          style={[estilos.inputDescripcion, { minHeight: 96 }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChange}
          accessibilityLabel={etiqueta}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoComplete="off"
          maxLength={MAX_DESCRIPCION}
        />
      </View>
      <Text style={estilos.contador}>
        {value.length}/{MAX_DESCRIPCION}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenido: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pasos: {
    gap: spacing.xs,
  },
  pasosFila: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasoCirculo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoCirculoActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pasoCirculoCompleto: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pasoNumero: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  pasoNumeroActivo: {
    color: colors.white,
  },
  pasoLinea: {
    flex: 1,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  pasoLineaActiva: {
    backgroundColor: colors.primary,
  },
  pasosEtiquetas: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  pasoEtiqueta: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pasoEtiquetaActiva: {
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  encabezadoPaso: {
    gap: spacing.xs,
  },
  kickerFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  tituloPaso: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtituloPaso: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  seccion: {
    gap: spacing.sm,
  },
  tituloBloque: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  tarjetaTipo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  tarjetaTipoAccesible: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
  },
  tarjetaTipoBarrera: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  tarjetaTipoActiva: {
    borderColor: colors.primary,
  },
  iconoTipoAccesible: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoTipoBarrera: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosTipo: {
    flex: 1,
    gap: spacing.xs,
  },
  tituloTipoAccesible: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  tituloTipoBarrera: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.warning,
  },
  textoTipo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  chipInterno: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  textoChipInterno: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  etiquetaGrupo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filaOpciones: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  opcion: {
    flex: 1,
    minHeight: TOUCH_TARGET * 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.white,
  },
  opcionActiva: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  opcionTitulo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  opcionDescripcion: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  filaLugar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  filaLugarActiva: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  textosLugar: {
    flex: 1,
    gap: 2,
  },
  nombreLugar: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  detalleLugar: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  textoExitoPequeno: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  filaCoordenadas: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  campoMitad: {
    flex: 1,
  },
  contenedorDescripcion: {
    gap: spacing.xs,
  },
  etiquetaDescripcion: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  cajaDescripcion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  iconoMultilineaDescripcion: {
    marginTop: spacing.sm,
  },
  inputDescripcion: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  contador: {
    alignSelf: 'flex-end',
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  chipsEtiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  etiquetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
    flexGrow: 1,
    flexBasis: '30%',
  },
  etiquetaTexto: {
    flexShrink: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  vistaFoto: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  tarjetaSuave: {
    backgroundColor: colors.surface,
    shadowOpacity: 0,
    elevation: 0,
    gap: spacing.sm,
  },
  filaAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textoAviso: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errores: {
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  filaError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  textoError: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    lineHeight: 18,
  },
  avisoError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botonMitad: {
    flex: 1,
  },
  exitoCabecera: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  exitoCirculo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloExito: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },
  textoExito: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  tarjetaExitoResumen: {
    gap: spacing.md,
  },
  tituloCard: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  fotoResumen: {
    width: '100%',
    height: 150,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  filaResumen: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  textosResumen: {
    flex: 1,
    gap: spacing.xs,
  },
  etiquetaLinea: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  valorResumen: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  detalleResumen: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  filaGracias: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  textosGracias: {
    flex: 1,
    gap: 2,
  },
  tituloGracias: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  textoGracias: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  lineaResumen: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  etiquetaResumen: {
    fontWeight: fontWeight.semibold,
  },
  textoResumen: {
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  textoSecundario: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
