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
  Image,
  KeyboardAvoidingView,
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
  crearExperiencia,
  type TipoIncidencia,
} from '../services/api/feedback';
import { fotoDePoi } from '../services/mocks/fotosPoi';
import { usePoisStore } from '../store/poisStore';
import { Alerta } from '../utils/alerta';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

const ETIQUETAS_CALIFICACION = [
  '',
  'Muy mala',
  'Mala',
  'Regular',
  'Buena',
  'Excelente',
] as const;

const AYUDA_DISCREPANCIA =
  'Si algo no coincide con la información del lugar, cuéntanoslo para revisarlo.';

const TIPOS_INCIDENCIA: {
  id: TipoIncidencia;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'barrera', etiqueta: 'Barrera física', icono: 'hand-left-outline' },
  {
    id: 'informacion_incorrecta',
    etiqueta: 'Datos incorrectos',
    icono: 'information-circle-outline',
  },
  { id: 'cerrado', etiqueta: 'Lugar cerrado', icono: 'lock-closed-outline' },
  { id: 'otro', etiqueta: 'Otro', icono: 'ellipsis-horizontal' },
];

/**
 * Proceso 3 — retroalimentación post-viaje.
 *
 * Solo se llega aquí después de finalizar una visita (U07). La calificación
 * queda vinculada a esa visita y el backend impide calificarla dos veces.
 * Una nota ≤ 2 o una discrepancia explícita disparan la re-verificación
 * comunitaria del lugar.
 */
export function FeedbackScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Feedback'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { visitaId, poiId, poiNombre } = route.params;

  const poiPorId = usePoisStore((estado) => estado.poiPorId);
  const cargarPois = usePoisStore((estado) => estado.cargar);
  const poi = poiPorId(poiId);

  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [discrepancia, setDiscrepancia] = useState(false);
  const [tipoIncidencia, setTipoIncidencia] =
    useState<TipoIncidencia>('barrera');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [revisionAbierta, setRevisionAbierta] = useState(false);
  const [errorCalificacion, setErrorCalificacion] = useState<string | null>(
    null,
  );

  const foto = fotoDePoi(poiNombre, poi?.categoria ?? '');

  const seleccionarCalificacion = (valor: number) => {
    setCalificacion(valor);
    setErrorCalificacion(null);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(
        `${valor} de 5, ${ETIQUETAS_CALIFICACION[valor]}`,
      );
    }
  };

  const enviar = async () => {
    if (calificacion === 0) {
      setErrorCalificacion('Elige una calificación de 1 a 5 estrellas.');
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          'Elige una calificación de 1 a 5 estrellas.',
        );
      }
      return;
    }

    setEnviando(true);
    try {
      const resultado = await crearExperiencia({
        visita_id: visitaId,
        calificacion,
        comentario: comentario.trim() || undefined,
        discrepancia,
        tipo_incidencia: discrepancia ? tipoIncidencia : undefined,
        descripcion_incidencia:
          discrepancia && descripcion.trim() ? descripcion.trim() : undefined,
      });

      setRevisionAbierta(resultado.incidencia != null);
      setEnviada(true);
      // El lugar pudo pasar a «en revisión»: refresca el mapa y el detalle.
      void cargarPois();
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          'Gracias. Tu calificación se guardó correctamente.',
        );
      }
    } catch (error) {
      const mensaje =
        (error as Error)?.message ??
        'No pudimos guardar tu calificación. Inténtalo de nuevo.';
      if ((error as { status?: number })?.status === 409) {
        Alerta.alert('Visita ya calificada', mensaje, [
          { text: 'Volver al inicio', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alerta.alert('No se pudo enviar', mensaje);
      }
    } finally {
      setEnviando(false);
    }
  };

  const volverAlInicio = () => navigation.popToTop();
  const verElLugar = () => navigation.navigate('DetallePoi', { poiId });

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.barraNavegacion}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={estilos.botonAtras}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={estilos.tituloBarra}>Calificar visita</Text>
      </View>

      <KeyboardAvoidingView
        style={estilos.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
        >
          {enviada ? (
            <Card estilo={estilos.tarjetaExito}>
              <View style={estilos.iconoExito}>
                <Ionicons
                  name="checkmark-circle"
                  size={56}
                  color={colors.success}
                />
              </View>
              <Text style={estilos.tituloExito} accessibilityRole="header">
                ¡Gracias por tu calificación!
              </Text>
              <Text style={estilos.textoExito}>
                {revisionAbierta
                  ? 'Tu reporte abrió una revisión comunitaria: el lugar quedará marcado para que el equipo verifique la información.'
                  : 'Tu experiencia ya está publicada y ayuda a otros viajeros a elegir lugares accesibles.'}
              </Text>
              <View style={estilos.accionesExito}>
                <AppButton
                  titulo="Ver el lugar"
                  variante="contorno"
                  icono="location-outline"
                  onPress={verElLugar}
                  estilo={estilos.botonExito}
                />
                <AppButton
                  titulo="Volver al inicio"
                  icono="home-outline"
                  onPress={volverAlInicio}
                  estilo={estilos.botonExito}
                />
              </View>
            </Card>
          ) : (
            <>
              <View style={estilos.resumenPoi}>
                <Image
                  source={foto.fuente}
                  style={estilos.foto}
                  resizeMode="cover"
                  accessibilityRole="image"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`Foto de ${poiNombre}`}
                />
                <View style={estilos.textosResumen}>
                  <Text style={estilos.nombrePoi} numberOfLines={2}>
                    {poiNombre}
                  </Text>
                  <Text style={estilos.detallePoi}>
                    {poi
                      ? `${poi.categoria} • ${poi.ciudad}`
                      : 'Visita finalizada'}
                  </Text>
                  <Text style={estilos.ayudaPoi}>
                    Cuéntanos cómo fue tu experiencia.
                  </Text>
                </View>
              </View>

              <Card estilo={estilos.tarjeta}>
                <Text style={estilos.tituloSeccion} accessibilityRole="header">
                  Tu calificación
                </Text>
                <Text style={estilos.ayudaSeccion}>
                  ¿Qué tan accesible fue el lugar durante tu visita?
                </Text>

                <View
                  style={estilos.estrellas}
                  accessibilityLabel={
                    calificacion > 0
                      ? `Calificación elegida: ${calificacion} de 5, ${ETIQUETAS_CALIFICACION[calificacion]}`
                      : 'Sin calificación elegida'
                  }
                >
                  {[1, 2, 3, 4, 5].map((valor) => {
                    const activa = valor <= calificacion;
                    return (
                      <Pressable
                        key={valor}
                        onPress={() => seleccionarCalificacion(valor)}
                        accessibilityRole="button"
                        accessibilityLabel={`${valor} de 5, ${ETIQUETAS_CALIFICACION[valor]}`}
                        accessibilityState={{ selected: activa }}
                        hitSlop={6}
                        style={estilos.botonEstrella}
                      >
                        <Ionicons
                          name={activa ? 'star' : 'star-outline'}
                          size={38}
                          color="#F5B301"
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <Text
                  style={estilos.etiquetaCalificacion}
                  accessibilityLiveRegion="polite"
                >
                  {calificacion > 0
                    ? ETIQUETAS_CALIFICACION[calificacion]
                    : 'Toca una estrella para calificar'}
                </Text>
                {errorCalificacion ? (
                  <Text
                    style={estilos.textoError}
                    accessibilityLiveRegion="polite"
                  >
                    {errorCalificacion}
                  </Text>
                ) : null}

                <View style={estilos.separador} />

                <CampoTexto
                  etiqueta="Comentario"
                  icono="chatbubble-ellipses-outline"
                  placeholder="¿Qué te pareció la accesibilidad? (opcional)"
                  value={comentario}
                  onChangeText={setComentario}
                  multilinea
                  maximo={500}
                />
              </Card>

              <Card estilo={estilos.tarjeta}>
                <Pressable
                  onPress={() => setDiscrepancia((activa) => !activa)}
                  accessibilityRole="switch"
                  accessibilityLabel="Encontré una barrera o información incorrecta Si algo no coincide con la información del lugar, cuéntanoslo para revisarlo."
                  accessibilityState={{ checked: discrepancia }}
                  style={estilos.filaInterruptor}
                >
                  <View
                    style={[
                      estilos.iconoAviso,
                      discrepancia ? estilos.iconoAvisoActivo : null,
                    ]}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={24}
                      color={discrepancia ? colors.danger : colors.warning}
                    />
                  </View>
                  <View style={estilos.textosInterruptor}>
                    <Text style={estilos.tituloInterruptor}>
                      Encontré una barrera o información incorrecta
                    </Text>
                    <Text style={estilos.ayudaInterruptor}>
                      {AYUDA_DISCREPANCIA}
                    </Text>
                  </View>
                  <View
                    style={[
                      estilos.pistaInterruptor,
                      discrepancia ? estilos.pistaInterruptorActiva : null,
                    ]}
                  >
                    <View
                      style={[
                        estilos.bolitaInterruptor,
                        discrepancia ? estilos.bolitaInterruptorActiva : null,
                      ]}
                    />
                  </View>
                </Pressable>

                {discrepancia ? (
                  <View style={estilos.detalleDiscrepancia}>
                    <Text style={estilos.etiquetaTipos}>¿Qué encontraste?</Text>
                    <View style={estilos.chips}>
                      {TIPOS_INCIDENCIA.map((tipo) => {
                        const activo = tipoIncidencia === tipo.id;
                        return (
                          <Pressable
                            key={tipo.id}
                            onPress={() => setTipoIncidencia(tipo.id)}
                            accessibilityRole="radio"
                            accessibilityLabel={tipo.etiqueta}
                            aria-checked={activo}
                            style={[
                              estilos.chip,
                              activo ? estilos.chipActivo : null,
                            ]}
                          >
                            <Ionicons
                              name={tipo.icono}
                              size={15}
                              color={activo ? colors.white : colors.primary}
                            />
                            <Text
                              style={[
                                estilos.chipTexto,
                                activo ? estilos.chipTextoActivo : null,
                              ]}
                            >
                              {tipo.etiqueta}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <CampoTexto
                      etiqueta="Descripción de la discrepancia"
                      icono="document-text-outline"
                      placeholder="Ej. la rampa está bloqueada por una reja"
                      value={descripcion}
                      onChangeText={setDescripcion}
                      multilinea
                      maximo={500}
                    />
                  </View>
                ) : null}

                {calificacion > 0 && calificacion <= 2 ? (
                  <View style={estilos.avisoRevision}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.warning}
                    />
                    <Text style={estilos.textoAvisoRevision}>
                      Con una calificación de 2 o menos, el lugar pasará a
                      revisión comunitaria.
                    </Text>
                  </View>
                ) : null}
              </Card>

              <AppButton
                titulo="Enviar calificación"
                icono="send-outline"
                onPress={() => void enviar()}
                cargando={enviando}
                deshabilitado={calificacion === 0}
                pistaAccesibilidad="Guarda tu calificación y tu reporte de accesibilidad"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
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
  tituloBarra: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  contenido: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  resumenPoi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  foto: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  textosResumen: {
    flex: 1,
    gap: 2,
  },
  nombrePoi: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  detallePoi: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  ayudaPoi: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tarjeta: {
    gap: spacing.sm,
  },
  tituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  ayudaSeccion: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  estrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  botonEstrella: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiquetaCalificacion: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  textoError: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.danger,
  },
  separador: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  filaInterruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
  },
  iconoAviso: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoAvisoActivo: {
    backgroundColor: colors.dangerSoft,
  },
  textosInterruptor: {
    flex: 1,
    gap: 2,
  },
  tituloInterruptor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  ayudaInterruptor: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  pistaInterruptor: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  pistaInterruptorActiva: {
    backgroundColor: colors.primary,
  },
  bolitaInterruptor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  bolitaInterruptorActiva: {
    alignSelf: 'flex-end',
  },
  detalleDiscrepancia: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  etiquetaTipos: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
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
  avisoRevision: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  textoAvisoRevision: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  tarjetaExito: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  iconoExito: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloExito: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    textAlign: 'center',
  },
  textoExito: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  accionesExito: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  botonExito: {
    alignSelf: 'stretch',
  },
});
