import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { ConsensoAlcanzado } from '../../components/ConsensoAlcanzado';
import {
  AvatarInicial,
  EncabezadoMarca,
  InsigniaModerador,
} from '../../components/EncabezadoMarca';
import { EmptyState } from '../../components/EmptyState';
import { MapaWeb } from '../../components/MapaWeb';
import type { RootStackParamList } from '../../navigation/types';
import { urlPublicaEvidencia } from '../../services/evidencias';
import { decidirReporte, ReporteError } from '../../services/reportes';
import type { IconName } from '../../services/types';
import { useModeracionStore } from '../../store/moderacionStore';
import { useProfileStore } from '../../store/profileStore';
import {
  dimensionDeReporte,
  fechaHoraCorta,
  ICONO_DIMENSION,
  tipoDeReporte,
} from '../../utils/moderacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from '../../utils/theme';

/** Motivos de rechazo del mockup M05 (el elegido viaja como motivo auditado). */
export const MOTIVOS_RECHAZO = [
  {
    id: 'foto',
    titulo: 'Fotografía borrosa o no concluyente',
    detalle: 'La imagen no permite verificar la información.',
  },
  {
    id: 'falso_positivo',
    titulo: 'Falso positivo (no cumple normativas)',
    detalle:
      'El reporte no corresponde a una barrera o acceso según nuestros criterios.',
  },
  {
    id: 'gps',
    titulo: 'Ubicación GPS incorrecta',
    detalle: 'La ubicación no coincide con el lugar mostrado en la fotografía.',
  },
  {
    id: 'duplicado',
    titulo: 'Duplicado',
    detalle: 'Ya existe un reporte similar en esta ubicación.',
  },
] as const;

type IdMotivo = (typeof MOTIVOS_RECHAZO)[number]['id'];

/** Texto auditado del rechazo: motivo elegido + detalle opcional. */
export function motivoDeRechazo(id: IdMotivo, detalle: string): string {
  const motivo = MOTIVOS_RECHAZO.find((opcion) => opcion.id === id);
  const extra = detalle.trim();
  return extra ? `${motivo?.titulo}. ${extra}` : (motivo?.titulo ?? extra);
}

type Respuesta = 'si' | 'no' | null;

function PreguntaChecklist({
  icono,
  pregunta,
  ayuda,
  valor,
  onCambio,
}: {
  icono: IconName;
  pregunta: string;
  ayuda: string;
  valor: Respuesta;
  onCambio: (valor: Respuesta) => void;
}) {
  return (
    <View style={estilos.pregunta}>
      <Ionicons name={icono} size={20} color={colors.navy} />
      <View style={estilos.textosPregunta}>
        <Text style={estilos.textoPregunta}>{pregunta}</Text>
        <Text style={estilos.ayudaPregunta}>{ayuda}</Text>
      </View>
      {(['si', 'no'] as const).map((opcion) => (
        <Pressable
          key={opcion}
          onPress={() => onCambio(valor === opcion ? null : opcion)}
          style={estilos.casilla}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: valor === opcion }}
          accessibilityLabel={`${pregunta} ${opcion === 'si' ? 'Sí' : 'No'}`}
        >
          <Ionicons
            name={valor === opcion ? 'checkbox' : 'square-outline'}
            size={20}
            color={valor === opcion ? colors.primary : colors.textSlate}
          />
          <Text style={estilos.casillaTexto}>
            {opcion === 'si' ? 'Sí' : 'No'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** M04 — Revisión de reporte con evidencia; M05 — modal de rechazo. */
export function RevisionReporteScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const reporte = useModeracionStore((estado) => estado.seleccionado);
  const marcarCambio = useModeracionStore((estado) => estado.marcarCambio);
  const perfil = useProfileStore((estado) => estado.perfil);

  const [fotoActiva, setFotoActiva] = useState(0);
  const [gpsCoincide, setGpsCoincide] = useState<Respuesta>(null);
  const [informacionClara, setInformacionClara] = useState<Respuesta>(null);
  const [comentario, setComentario] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazoVisible, setRechazoVisible] = useState(false);
  const [motivo, setMotivo] = useState<IdMotivo | null>(null);
  const [detalleRechazo, setDetalleRechazo] = useState('');
  const [s01Visible, setS01Visible] = useState(false);

  if (!reporte) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EmptyState
          icono="document-text-outline"
          titulo="Sin reporte seleccionado"
          descripcion="Vuelve a la lista de pendientes y elige un reporte."
          textoBoton="Volver"
          onPressBoton={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const tipo = tipoDeReporte(reporte.esCritico);
  const dimension = dimensionDeReporte(reporte.valores);
  const fotos = reporte.evidencia.filter((item) => item.storageKey !== '');
  const tieneUbicacion =
    reporte.poi.lat !== undefined && reporte.poi.lon !== undefined;

  const decidir = async (
    accion: 'aprobado' | 'rechazado',
    motivoTexto?: string,
  ) => {
    setProcesando(true);
    setError(null);
    try {
      // El comentario del checklist acompaña la aprobación en el registro.
      await decidirReporte(
        reporte.id,
        accion,
        motivoTexto ?? (comentario.trim() || undefined),
      );
      marcarCambio();
      if (accion === 'aprobado') {
        setS01Visible(true);
      } else {
        setRechazoVisible(false);
        Alert.alert(
          'Reporte rechazado',
          'La persona que lo envió recibirá el motivo del rechazo.',
          [{ text: 'Entendido', onPress: () => navigation.goBack() }],
        );
      }
    } catch (causa) {
      setError(
        causa instanceof ReporteError
          ? causa.message
          : 'No pudimos completar la decisión. Inténtalo de nuevo.',
      );
    } finally {
      setProcesando(false);
    }
  };

  const aprobar = () => {
    if (gpsCoincide === 'no' || informacionClara === 'no') {
      Alert.alert(
        'Revisa el checklist',
        'Marcaste que la evidencia no coincide o no es clara. ¿Quieres rechazar el reporte?',
        [
          { text: 'Revisar de nuevo', style: 'cancel' },
          {
            text: 'Rechazar',
            style: 'destructive',
            onPress: () => setRechazoVisible(true),
          },
        ],
      );
      return;
    }
    void decidir('aprobado');
  };

  const confirmarRechazo = () => {
    if (!motivo) {
      setError('Selecciona el motivo del rechazo.');
      return;
    }
    void decidir('rechazado', motivoDeRechazo(motivo, detalleRechazo));
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'bottom']}>
      <View style={estilos.cabecera}>
        <EncabezadoMarca
          tamanoLogo={34}
          onAtras={() => navigation.goBack()}
          derecha={
            <>
              <InsigniaModerador />
              <AvatarInicial
                texto={perfil?.nombre ?? 'M'}
                tamano={38}
                enLinea
              />
            </>
          }
        />
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.filaTitulo}>
          <View style={estilos.textosTitulo}>
            <Text style={estilos.titulo} accessibilityRole="header">
              Revisión de Reporte
            </Text>
            <Text style={estilos.subtitulo}>
              Valida la información antes de su publicación.
            </Text>
          </View>
          <View style={estilos.columnaEstado}>
            <View style={estilos.estado}>
              <Ionicons name="time-outline" size={14} color="#B45309" />
              <Text style={estilos.estadoTexto}>Pendiente</Text>
            </View>
            <Text style={estilos.idReporte}>ID: #{reporte.id}</Text>
          </View>
        </View>

        <View style={estilos.tarjeta}>
          <View style={estilos.filaResumen}>
            <View style={[estilos.iconoTipo, { backgroundColor: tipo.color }]}>
              <Ionicons name={tipo.icono} size={20} color={colors.white} />
            </View>
            <View style={estilos.textosResumen}>
              <Text style={estilos.nombre}>{reporte.poi.nombre}</Text>
              <Text style={estilos.tipoTexto}>{tipo.texto}</Text>
            </View>
            <View style={estilos.dimension}>
              <Ionicons
                name={ICONO_DIMENSION[dimension]}
                size={12}
                color={colors.danger}
              />
              <Text style={estilos.dimensionTexto}>{dimension}</Text>
            </View>
            <View style={estilos.fecha}>
              <Ionicons name="calendar-outline" size={16} color={colors.navy} />
              <Text style={estilos.fechaTexto}>
                {fechaHoraCorta(reporte.fechaCreacion)}
              </Text>
            </View>
          </View>

          <View style={estilos.filaEvidencia}>
            {fotos.length > 0 ? (
              <Image
                source={{
                  uri: urlPublicaEvidencia(fotos[fotoActiva]?.storageKey ?? ''),
                }}
                style={estilos.evidencia}
                accessibilityRole="image"
                accessibilityIgnoresInvertColors
                accessibilityLabel={`Evidencia fotográfica de ${reporte.poi.nombre}`}
              />
            ) : (
              <View style={[estilos.evidencia, estilos.sinFoto]}>
                <Ionicons
                  name="image-outline"
                  size={30}
                  color={colors.textMuted}
                />
                <Text style={estilos.sinFotoTexto}>Sin foto de evidencia</Text>
              </View>
            )}
            <View style={estilos.columnaMapa}>
              {tieneUbicacion ? (
                <View style={estilos.mapa} pointerEvents="none">
                  <MapaWeb
                    pois={[
                      {
                        id: reporte.poi.id,
                        nombre: reporte.poi.nombre,
                        latitud: reporte.poi.lat as number,
                        longitud: reporte.poi.lon as number,
                        activo: true,
                        pendiente: true,
                        barrera: reporte.esCritico,
                      },
                    ]}
                    vistaInicial={{
                      latitude: reporte.poi.lat as number,
                      longitude: reporte.poi.lon as number,
                    }}
                    onPoiPulsado={() => undefined}
                  />
                </View>
              ) : (
                <View style={[estilos.mapa, estilos.sinFoto]}>
                  <Ionicons
                    name="map-outline"
                    size={24}
                    color={colors.textMuted}
                  />
                </View>
              )}
              <View style={estilos.coordenadas}>
                <Ionicons name="location" size={14} color={colors.navy} />
                <View style={estilos.textosCoordenadas}>
                  <Text style={estilos.coordTitulo}>Coordenadas exactas</Text>
                  {tieneUbicacion ? (
                    <Text style={estilos.coordTexto}>
                      {reporte.poi.lat?.toFixed(4)},{' '}
                      {reporte.poi.lon?.toFixed(4)}
                    </Text>
                  ) : null}
                  <Text style={estilos.coordTexto} numberOfLines={2}>
                    {reporte.poi.direccion || 'Sin dirección'}
                  </Text>
                </View>
              </View>
              {tieneUbicacion ? (
                <Pressable
                  onPress={() =>
                    void Linking.openURL(
                      `https://www.openstreetmap.org/?mlat=${reporte.poi.lat}&mlon=${reporte.poi.lon}#map=18/${reporte.poi.lat}/${reporte.poi.lon}`,
                    )
                  }
                  style={estilos.verMapa}
                  accessibilityRole="link"
                >
                  <Text style={estilos.verMapaTexto}>Ver en mapa completo</Text>
                  <Ionicons
                    name="open-outline"
                    size={12}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={estilos.tarjetaAutor}>
          <View style={estilos.autor}>
            <View style={estilos.iconoAutor}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>
            <View style={estilos.textosAutor}>
              <Text style={estilos.autorEtiqueta}>Reportado por</Text>
              <Text style={estilos.autorNombre} numberOfLines={1}>
                {reporte.autor ?? 'Cuenta eliminada'}
              </Text>
              <Text style={estilos.autorEtiqueta}>
                {reporte.confirmaciones}/3 confirmaciones
              </Text>
            </View>
          </View>
          <View style={estilos.comentarioColaborador}>
            <Text style={estilos.comillas}>❝ Comentario del colaborador</Text>
            <Text style={estilos.textoColaborador}>
              {reporte.descripcion || 'Sin comentario adicional.'}
            </Text>
          </View>
        </View>

        {fotos.length > 1 ? (
          <View style={estilos.miniaturas}>
            {fotos.slice(0, 4).map((foto, indice) => (
              <Pressable
                key={foto.id}
                onPress={() => setFotoActiva(indice)}
                accessibilityRole="button"
                accessibilityLabel={`Ver foto ${indice + 1}`}
              >
                <Image
                  source={{ uri: urlPublicaEvidencia(foto.storageKey) }}
                  style={[
                    estilos.miniatura,
                    indice === fotoActiva ? estilos.miniaturaActiva : null,
                  ]}
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {reporte.valores.length > 0 ? (
          <View style={estilos.tarjeta}>
            <Text style={estilos.tituloSeccion}>Valores propuestos</Text>
            {reporte.valores.map((valor) => (
              <View key={valor.caracteristicaId} style={estilos.valor}>
                <Text style={estilos.valorNombre}>{valor.nombre}</Text>
                <Text style={estilos.valorDato}>
                  {valor.valorBooleano !== undefined
                    ? valor.valorBooleano
                      ? 'Sí'
                      : 'No'
                    : (valor.valorNumerico ?? valor.valorTexto ?? '—')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={estilos.tituloSeccion}>Checklist de auditoría visual</Text>
        <View style={estilos.tarjeta}>
          <PreguntaChecklist
            icono="location-outline"
            pregunta="¿La foto coincide con la ubicación GPS?"
            ayuda="Verifica que los elementos de la imagen correspondan al entorno del mapa."
            valor={gpsCoincide}
            onCambio={setGpsCoincide}
          />
          <View style={estilos.divisor} />
          <PreguntaChecklist
            icono="document-text-outline"
            pregunta="¿Es información verídica y clara?"
            ayuda="Evalúa que la imagen y el comentario sean coherentes y no contengan información engañosa."
            valor={informacionClara}
            onCambio={setInformacionClara}
          />
          <View style={estilos.divisor} />
          <Text style={estilos.etiquetaComentario}>
            <Ionicons name="chatbox-ellipses-outline" size={13} /> Agregar un
            comentario (opcional)
          </Text>
          <TextInput
            value={comentario}
            onChangeText={setComentario}
            placeholder="Escribe tus observaciones..."
            placeholderTextColor={colors.textMuted}
            style={estilos.inputComentario}
            autoComplete="off"
            accessibilityLabel="Comentario de la revisión (opcional)"
            maxLength={250}
          />
        </View>

        {error && !rechazoVisible ? (
          <Text style={estilos.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={estilos.barraAcciones}>
        <AppButton
          titulo="Aprobar Publicación"
          icono="checkmark"
          variante="exito"
          forma="redondeado"
          compacto
          onPress={aprobar}
          cargando={procesando && !rechazoVisible}
          estilo={estilos.botonAccion}
        />
        <AppButton
          titulo="Rechazar Reporte"
          icono="close"
          variante="peligro"
          forma="redondeado"
          compacto
          onPress={() => {
            setError(null);
            setRechazoVisible(true);
          }}
          deshabilitado={procesando}
          estilo={estilos.botonAccion}
        />
      </View>

      <Modal
        visible={rechazoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRechazoVisible(false)}
      >
        <View style={estilos.fondoModal}>
          <View style={estilos.hoja}>
            <View style={estilos.asa} />
            <ScrollView contentContainerStyle={estilos.contenidoHoja}>
              <View style={estilos.cabeceraHoja}>
                <View style={estilos.iconoRechazo}>
                  <Ionicons name="close" size={30} color={colors.white} />
                </View>
                <View style={estilos.textosHoja}>
                  <Text style={estilos.tituloHoja} accessibilityRole="header">
                    Motivo del rechazo
                  </Text>
                  <Text style={estilos.subtituloHoja}>
                    Selecciona el motivo por el cual este reporte no será
                    publicado.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setRechazoVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  hitSlop={10}
                >
                  <Ionicons name="close" size={24} color={colors.navy} />
                </Pressable>
              </View>

              <View accessibilityRole="radiogroup" style={estilos.opciones}>
                {MOTIVOS_RECHAZO.map((opcion) => {
                  const elegido = motivo === opcion.id;
                  return (
                    <Pressable
                      key={opcion.id}
                      onPress={() => setMotivo(opcion.id)}
                      style={[
                        estilos.opcion,
                        elegido ? estilos.opcionElegida : null,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: elegido }}
                      accessibilityLabel={`${opcion.titulo}. ${opcion.detalle}`}
                    >
                      <Ionicons
                        name={elegido ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={elegido ? colors.danger : colors.textSlate}
                      />
                      <View style={estilos.textosOpcion}>
                        <Text style={estilos.tituloOpcion}>
                          {opcion.titulo}
                        </Text>
                        <Text style={estilos.detalleOpcion}>
                          {opcion.detalle}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={estilos.etiquetaComentario}>
                <Ionicons name="chatbox-ellipses" size={13} /> Detalles
                adicionales (opcional)
              </Text>
              <TextInput
                value={detalleRechazo}
                onChangeText={setDetalleRechazo}
                placeholder="Escribe un comentario para el usuario..."
                placeholderTextColor={colors.textMuted}
                style={[estilos.inputComentario, estilos.inputMultilinea]}
                multiline
                maxLength={250}
                textAlignVertical="top"
                autoComplete="off"
                accessibilityLabel="Detalles adicionales del rechazo"
              />
              <Text style={estilos.contador}>{detalleRechazo.length}/250</Text>

              <View style={estilos.avisoRechazo}>
                <Ionicons
                  name="information-circle"
                  size={22}
                  color={colors.danger}
                />
                <Text style={estilos.textoAviso}>
                  El usuario que realizó el reporte recibirá una notificación
                  con el motivo del rechazo para que pueda entender la decisión
                  y, si lo considera, enviar un nuevo reporte.
                </Text>
              </View>

              {error ? (
                <Text style={estilos.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
            </ScrollView>
            <View style={estilos.barraModal}>
              <Pressable
                onPress={() => setRechazoVisible(false)}
                style={estilos.cancelar}
                accessibilityRole="button"
              >
                <Text style={estilos.cancelarTexto}>Cancelar</Text>
              </Pressable>
              <AppButton
                titulo="Confirmar Rechazo"
                icono="close"
                variante="peligro"
                forma="redondeado"
                compacto
                onPress={confirmarRechazo}
                cargando={procesando}
                estilo={estilos.botonAccion}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ConsensoAlcanzado
        visible={s01Visible}
        poiNombre={reporte.poi.nombre}
        mensaje={`Aprobaste el reporte: «${reporte.poi.nombre}» ahora es visible en el mapa para todos.`}
        onCerrar={() => {
          setS01Visible(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg },
  contenido: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  filaTitulo: { flexDirection: 'row', gap: spacing.sm },
  textosTitulo: { flex: 1, gap: 2 },
  titulo: {
    fontSize: fontSize.xl + 2,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: { fontSize: fontSize.sm, color: colors.textSlate },
  columnaEstado: { alignItems: 'flex-end', gap: spacing.xs },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF0DC',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  estadoTexto: {
    fontSize: fontSize.xs,
    color: '#B45309',
    fontWeight: fontWeight.semibold,
  },
  idReporte: { fontSize: 11, color: colors.textSlate },
  tarjeta: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  filaResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  iconoTipo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosResumen: { flex: 1, minWidth: 120 },
  nombre: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  tipoTexto: { fontSize: fontSize.xs, color: colors.textSlate },
  dimension: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FDECEC',
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dimensionTexto: { fontSize: 11, color: colors.danger },
  fecha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fechaTexto: { fontSize: 11, color: colors.textSlate },
  filaEvidencia: { flexDirection: 'row', gap: spacing.sm },
  evidencia: { flex: 1.4, height: 190, borderRadius: radii.sm },
  sinFoto: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sinFotoTexto: { fontSize: 11, color: colors.textSlate },
  columnaMapa: { flex: 1, gap: 4 },
  mapa: { height: 92, borderRadius: radii.sm, overflow: 'hidden' },
  coordenadas: { flexDirection: 'row', gap: 4 },
  textosCoordenadas: { flex: 1 },
  coordTitulo: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  coordTexto: { fontSize: 10, color: colors.textSlate },
  verMapa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 4,
    justifyContent: 'center',
  },
  verMapaTexto: { fontSize: 10, color: colors.primary },
  tarjetaAutor: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#F4F7FB',
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  autor: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '42%',
    alignItems: 'center',
  },
  iconoAutor: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosAutor: { flex: 1 },
  autorEtiqueta: { fontSize: 10, color: colors.textSlate },
  autorNombre: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  comentarioColaborador: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  comillas: { fontSize: 10, color: colors.textSlate },
  textoColaborador: { fontSize: 11, color: colors.textSlate, lineHeight: 15 },
  miniaturas: { flexDirection: 'row', gap: spacing.sm },
  miniatura: {
    width: 72,
    height: 54,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniaturaActiva: { borderColor: colors.primary },
  tituloSeccion: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  valor: { flexDirection: 'row', justifyContent: 'space-between' },
  valorNombre: { fontSize: fontSize.sm, color: colors.textPrimary },
  valorDato: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  pregunta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  textosPregunta: { flex: 1 },
  textoPregunta: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  ayudaPregunta: { fontSize: 10, color: colors.textSlate },
  casilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
  },
  casillaTexto: { fontSize: 11, color: colors.navy },
  divisor: { height: 1, backgroundColor: colors.border },
  etiquetaComentario: { fontSize: fontSize.xs, color: colors.textSlate },
  inputComentario: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  inputMultilinea: { minHeight: 90, paddingTop: spacing.sm },
  contador: { alignSelf: 'flex-end', fontSize: 11, color: colors.textSlate },
  error: { color: colors.danger, fontSize: fontSize.sm },
  barraAcciones: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  botonAccion: { flex: 1 },
  fondoModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '88%',
  },
  asa: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  contenidoHoja: { padding: spacing.lg, gap: spacing.md },
  cabeceraHoja: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconoRechazo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosHoja: { flex: 1, gap: 2 },
  tituloHoja: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtituloHoja: { fontSize: fontSize.sm, color: colors.textSlate },
  opciones: { gap: spacing.sm },
  opcion: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  opcionElegida: { borderColor: colors.danger, backgroundColor: '#FFF7F7' },
  textosOpcion: { flex: 1, gap: 2 },
  tituloOpcion: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  detalleOpcion: { fontSize: fontSize.xs, color: colors.textSlate },
  avisoRechazo: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#FDECEC',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  textoAviso: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#8A1C1C',
    lineHeight: 17,
  },
  barraModal: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelar: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: '#E5EAF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarTexto: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
});
