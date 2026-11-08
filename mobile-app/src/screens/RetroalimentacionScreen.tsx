import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { CampoTexto } from '../components/CampoTexto';
import { Card } from '../components/Card';
import type { RootStackParamList } from '../navigation/types';
import {
  enviarRetroalimentacion,
  type ResultadoRetroalimentacion,
} from '../services/retroalimentacion';
import { usePoisStore } from '../store/poisStore';
import {
  abriraIncidencia,
  BORRADOR_RETRO_INICIAL,
  construirCuerpoRetro,
  ETIQUETA_CALIFICACION,
  LARGO_MAX_COMENTARIO,
  TIPOS_DISCREPANCIA,
  validarBorradorRetro,
  type BorradorRetroalimentacion,
  type ErroresRetroalimentacion,
} from '../utils/retroalimentacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

/**
 * U13 — Retroalimentación post-viaje (Proceso 3).
 *
 * Se abre al pulsar «Finalizar ruta» (U07) o «Calificar mi visita» (U08).
 * La persona califica el lugar (1–5), deja un comentario y responde si la
 * accesibilidad coincidía con lo publicado. Si no coincidía (o califica con
 * 1–2), el backend abre una incidencia que moderación atiende en M06 y que
 * puede terminar en una re-verificación del Proceso 1.
 */
export function RetroalimentacionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Retroalimentacion'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { poiId, origen } = route.params;
  const poi = usePoisStore((estado) => estado.poiPorId(poiId));
  const recargarPois = usePoisStore((estado) => estado.cargar);

  const [borrador, setBorrador] = useState<BorradorRetroalimentacion>(
    BORRADOR_RETRO_INICIAL,
  );
  const [errores, setErrores] = useState<ErroresRetroalimentacion>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoRetroalimentacion | null>(
    null,
  );

  const actualizar = (cambios: Partial<BorradorRetroalimentacion>) => {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    setErrores({});
    setErrorEnvio(null);
  };

  const enviar = async () => {
    const encontrados = validarBorradorRetro(borrador);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      // En Android las regiones «live» ya lo anuncian (evita doble lectura).
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          'Revisa los campos marcados antes de enviar.',
        );
      }
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const respuesta = await enviarRetroalimentacion(
        construirCuerpoRetro(poiId, borrador),
      );
      setResultado(respuesta);
      void recargarPois();
      // En Android las regiones «live» ya lo anuncian (evita doble lectura).
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          'Gracias, tu experiencia quedó registrada.',
        );
      }
    } catch (error) {
      setErrorEnvio((error as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const volver = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.popToTop();
    }
  };

  const nombreLugar = poi?.nombre ?? 'este lugar';

  if (resultado) {
    return (
      <SafeAreaView style={estilos.pantalla} edges={['top', 'bottom']}>
        <View style={estilos.exito} accessibilityLiveRegion="polite">
          <View style={estilos.iconoExito}>
            <Ionicons
              name={
                resultado.escalada ? 'shield-checkmark' : 'checkmark-circle'
              }
              size={56}
              color={resultado.escalada ? colors.warning : colors.success}
            />
          </View>
          <Text style={estilos.tituloExito} accessibilityRole="header">
            ¡Gracias por tu experiencia!
          </Text>
          <Text style={estilos.textoExito}>
            {resultado.escalada
              ? `Registramos una incidencia sobre ${nombreLugar}. Moderación la revisará y, si hace falta, pedirá a la comunidad una nueva verificación del lugar.`
              : `Tu calificación ya aparece en la ficha de ${nombreLugar} y ayuda a otros viajeros a planear su visita.`}
          </Text>
          {resultado.escalada && resultado.incidenciaId ? (
            <Text style={estilos.referencia}>
              Incidencia #{resultado.incidenciaId}
            </Text>
          ) : null}
          <AppButton
            titulo="Volver al lugar"
            icono="location-outline"
            onPress={() =>
              // Desde la ficha (U08) se vuelve a ella; desde la ruta se abre.
              origen === 'visita'
                ? volver()
                : navigation.replace('DetallePoi', { poiId })
            }
            estilo={estilos.botonExito}
          />
          <AppButton
            titulo="Volver al inicio"
            variante="contorno"
            icono="map-outline"
            onPress={() => navigation.popToTop()}
            estilo={estilos.botonExito}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.barraNavegacion}>
        <Pressable
          onPress={volver}
          style={estilos.botonAtras}
          accessibilityRole="button"
          accessibilityLabel="Volver sin calificar"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          ¿Cómo te fue?
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={estilos.subtitulo}>
          {origen === 'ruta'
            ? `Terminaste tu ruta a ${nombreLugar}. `
            : `Cuéntanos sobre tu visita a ${nombreLugar}. `}
          Tu experiencia mantiene actualizada la información de accesibilidad.
        </Text>

        <Card estilo={estilos.tarjeta}>
          <Text style={estilos.pregunta}>
            Califica la accesibilidad del lugar
          </Text>
          <View
            style={estilos.estrellas}
            accessibilityRole="radiogroup"
            accessibilityLabel="Calificación de 1 a 5 estrellas"
          >
            {[1, 2, 3, 4, 5].map((valor) => {
              const activa = borrador.calificacion >= valor;
              return (
                <Pressable
                  key={valor}
                  onPress={() => actualizar({ calificacion: valor })}
                  style={estilos.estrella}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: borrador.calificacion === valor,
                  }}
                  accessibilityLabel={`${valor} de 5: ${ETIQUETA_CALIFICACION[valor]}`}
                >
                  <Ionicons
                    name={activa ? 'star' : 'star-outline'}
                    size={36}
                    color={activa ? '#F5B301' : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={estilos.etiquetaCalificacion}>
            {borrador.calificacion
              ? ETIQUETA_CALIFICACION[borrador.calificacion]
              : 'Toca una estrella'}
          </Text>
          {errores.calificacion ? (
            <Text style={estilos.error}>{errores.calificacion}</Text>
          ) : null}
        </Card>

        <Card estilo={estilos.tarjeta}>
          <Text style={estilos.pregunta}>
            ¿La accesibilidad coincidía con lo publicado en OmniTravel?
          </Text>
          <View style={estilos.filaOpciones} accessibilityRole="radiogroup">
            {[
              {
                valor: true,
                texto: 'Sí, coincidía',
                icono: 'checkmark' as const,
              },
              { valor: false, texto: 'No coincidía', icono: 'alert' as const },
            ].map((opcion) => {
              const elegida = borrador.coincide === opcion.valor;
              return (
                <Pressable
                  key={opcion.texto}
                  onPress={() =>
                    actualizar({
                      coincide: opcion.valor,
                      ...(opcion.valor
                        ? {
                            tipoDiscrepancia: null,
                            descripcionDiscrepancia: '',
                          }
                        : {}),
                    })
                  }
                  style={[
                    estilos.opcion,
                    elegida ? estilos.opcionElegida : null,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegida }}
                >
                  <Ionicons
                    name={opcion.icono}
                    size={18}
                    color={elegida ? colors.white : colors.primary}
                  />
                  <Text
                    style={[
                      estilos.textoOpcion,
                      elegida ? estilos.textoOpcionElegida : null,
                    ]}
                  >
                    {opcion.texto}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errores.coincide ? (
            <Text style={estilos.error}>{errores.coincide}</Text>
          ) : null}

          {borrador.coincide === false ? (
            <View style={estilos.discrepancia}>
              <Text style={estilos.pregunta}>¿Qué no coincidía?</Text>
              {TIPOS_DISCREPANCIA.map((tipo) => {
                const elegido = borrador.tipoDiscrepancia === tipo.valor;
                return (
                  <Pressable
                    key={tipo.valor}
                    onPress={() => actualizar({ tipoDiscrepancia: tipo.valor })}
                    style={[estilos.tipo, elegido ? estilos.tipoElegido : null]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: elegido }}
                    accessibilityLabel={`${tipo.etiqueta}. ${tipo.descripcion}`}
                  >
                    <Ionicons
                      name={elegido ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={colors.primary}
                    />
                    <View style={estilos.textosTipo}>
                      <Text style={estilos.etiquetaTipo}>{tipo.etiqueta}</Text>
                      <Text style={estilos.descripcionTipo}>
                        {tipo.descripcion}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {errores.tipoDiscrepancia ? (
                <Text style={estilos.error}>{errores.tipoDiscrepancia}</Text>
              ) : null}
              <CampoTexto
                etiqueta="Describe lo que encontraste"
                icono="create-outline"
                placeholder="Ej.: la rampa de la entrada está bloqueada por obras"
                value={borrador.descripcionDiscrepancia}
                onChangeText={(texto) =>
                  actualizar({ descripcionDiscrepancia: texto })
                }
                error={errores.descripcionDiscrepancia}
                multilinea
                maximo={LARGO_MAX_COMENTARIO}
              />
            </View>
          ) : null}
        </Card>

        <CampoTexto
          etiqueta="Comentario para otros viajeros (opcional)"
          icono="chatbubble-ellipses-outline"
          placeholder="¿Qué le recomendarías a alguien con tus mismas necesidades?"
          value={borrador.comentario}
          onChangeText={(texto) => actualizar({ comentario: texto })}
          error={errores.comentario}
          multilinea
          maximo={LARGO_MAX_COMENTARIO}
        />

        {abriraIncidencia(borrador) ? (
          <View style={estilos.aviso} accessibilityLiveRegion="polite">
            <Ionicons
              name="information-circle"
              size={18}
              color={colors.warning}
            />
            <Text style={estilos.textoAviso}>
              Al enviar se abrirá una incidencia para que moderación revise la
              información de este lugar.
            </Text>
          </View>
        ) : null}

        {errorEnvio ? (
          <View style={estilos.bloqueError} accessibilityLiveRegion="polite">
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color={colors.danger}
            />
            <Text style={estilos.textoError}>{errorEnvio}</Text>
          </View>
        ) : null}

        <AppButton
          titulo="Enviar experiencia"
          icono="send"
          cargando={enviando}
          deshabilitado={enviando}
          onPress={() => void enviar()}
          pistaAccesibilidad="Registra tu calificación y comentario del lugar"
        />
        <AppButton
          titulo="Ahora no"
          variante="fantasma"
          onPress={volver}
          deshabilitado={enviando}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  barraNavegacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  botonAtras: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloBarra: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  contenido: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  subtitulo: { fontSize: fontSize.md, color: colors.textSlate, lineHeight: 22 },
  tarjeta: { gap: spacing.sm },
  pregunta: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  estrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  estrella: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiquetaCalificacion: {
    textAlign: 'center',
    color: colors.textSlate,
    fontSize: fontSize.sm,
  },
  filaOpciones: { flexDirection: 'row', gap: spacing.sm },
  opcion: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  opcionElegida: { backgroundColor: colors.primary },
  textoOpcion: { color: colors.primary, fontWeight: fontWeight.semibold },
  textoOpcionElegida: { color: colors.white },
  discrepancia: { gap: spacing.sm, marginTop: spacing.sm },
  tipo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    minHeight: TOUCH_TARGET,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipoElegido: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  textosTipo: { flex: 1 },
  etiquetaTipo: { color: colors.textPrimary, fontWeight: fontWeight.semibold },
  descripcionTipo: { color: colors.textSecondary, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.sm },
  aviso: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
  },
  textoAviso: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm },
  bloqueError: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
  },
  textoError: { flex: 1, color: colors.danger, fontSize: fontSize.sm },
  exito: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconoExito: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  tituloExito: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    textAlign: 'center',
  },
  textoExito: {
    fontSize: fontSize.md,
    color: colors.textSlate,
    textAlign: 'center',
    lineHeight: 22,
  },
  referencia: { fontSize: fontSize.sm, color: colors.textSecondary },
  botonExito: { alignSelf: 'stretch' },
});
