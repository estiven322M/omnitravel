import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AvatarInicial,
  EncabezadoMarca,
  InsigniaModerador,
} from '../../components/EncabezadoMarca';
import type { RootStackParamList } from '../../navigation/types';
import { urlPublicaEvidencia } from '../../services/evidencias';
import {
  obtenerResumenModeracion,
  type ResumenModeracion,
} from '../../services/moderacion';
import type { IconName } from '../../services/types';
import { useProfileStore } from '../../store/profileStore';
import { fechaHoraCorta, haceCuanto } from '../../utils/moderacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from '../../utils/theme';

interface PropsCifra {
  valor: number;
  titulo: string;
  detalle: string;
  pie: string;
  icono: IconName;
  color: string;
  fondo: string;
  onPress: () => void;
}

function TarjetaCifra({
  valor,
  titulo,
  detalle,
  pie,
  icono,
  color,
  fondo,
  onPress,
}: PropsCifra) {
  return (
    <Pressable
      onPress={onPress}
      style={[estilos.cifra, { backgroundColor: fondo }]}
      accessibilityRole="button"
      accessibilityLabel={`${valor} ${titulo} ${detalle}. ${pie}`}
    >
      <View style={[estilos.iconoCifra, { backgroundColor: color }]}>
        <Ionicons name={icono} size={18} color={colors.white} />
      </View>
      <View style={estilos.filaValor}>
        <Text style={estilos.valorCifra}>{valor}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.navy} />
      </View>
      <Text style={estilos.tituloCifra}>{titulo}</Text>
      {detalle ? <Text style={estilos.detalleCifra}>{detalle}</Text> : null}
      <Text style={estilos.pieCifra}>{pie}</Text>
    </Pressable>
  );
}

const ACCION_TEXTO: Record<string, string> = {
  aprobar: 'Reporte verificado y publicado',
  rechazar: 'Reporte rechazado',
  marcar_revision: 'Reporte marcado para revisión',
};

/** M02 — Tablero del moderador: cifras reales, alertas críticas y actividad. */
export function DashboardModeradorScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const perfil = useProfileStore((estado) => estado.perfil);
  const [resumen, setResumen] = useState<ResumenModeracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setResumen(await obtenerResumenModeracion());
      setError(null);
    } catch (causa) {
      setError((causa as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const recargar = async () => {
    setRecargando(true);
    await cargar();
    setRecargando(false);
  };

  const irAReportes = () =>
    navigation.navigate('PanelModerador', { screen: 'ReportesModerador' });
  const nombre = perfil?.nombre.split(' ')[0] ?? 'Moderador';
  const hoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.cabecera}>
        <EncabezadoMarca
          tamanoLogo={36}
          derecha={
            <>
              <InsigniaModerador />
              <Pressable
                onPress={() => navigation.navigate('Notificaciones')}
                accessibilityRole="button"
                accessibilityLabel={`Notificaciones${
                  resumen?.pendientes
                    ? `, ${resumen.pendientes} pendientes`
                    : ''
                }`}
                hitSlop={8}
              >
                <Ionicons
                  name="notifications"
                  size={24}
                  color={colors.primary}
                />
                {resumen && resumen.pendientes > 0 ? (
                  <View style={estilos.punto}>
                    <Text style={estilos.puntoTexto}>
                      {Math.min(resumen.pendientes, 99)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              <AvatarInicial texto={nombre} tamano={38} enLinea />
            </>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={recargando}
            onRefresh={() => void recargar()}
          />
        }
      >
        <View style={estilos.saludo}>
          <View style={estilos.textosSaludo}>
            <Text style={estilos.hola} accessibilityRole="header">
              Hola, {nombre}
            </Text>
            <Text style={estilos.gracias}>
              Gracias por ayudar a construir un turismo más accesible e
              inclusivo.
            </Text>
          </View>
          <Text style={estilos.fecha}>{hoy}</Text>
        </View>

        {error ? (
          <Text style={estilos.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {!resumen && !error ? (
          <ActivityIndicator color={colors.primary} style={estilos.cargando} />
        ) : null}

        {resumen ? (
          <>
            <View style={estilos.cifras}>
              <TarjetaCifra
                valor={resumen.pendientes}
                titulo="Reportes Pendientes"
                detalle="(Crowdsourcing)"
                pie="Requieren tu revisión"
                icono="document-text"
                color={colors.primary}
                fondo="#EAF2FC"
                onPress={irAReportes}
              />
              <TarjetaCifra
                valor={resumen.discrepancias}
                titulo="Discrepancias Post-Viaje"
                detalle=""
                pie="Reportes con opiniones encontradas"
                icono="warning"
                color={colors.warning}
                fondo="#FEF4E8"
                onPress={() => navigation.navigate('Incidencias')}
              />
              <TarjetaCifra
                valor={resumen.verificadosHoy}
                titulo="Puntos Verificados Hoy"
                detalle=""
                pie="¡Gracias por tu labor!"
                icono="checkmark"
                color={colors.success}
                fondo="#EAF6EF"
                onPress={irAReportes}
              />
            </View>

            <View style={estilos.alertas}>
              <View style={estilos.cabeceraAlertas}>
                <View style={estilos.iconoAlertas}>
                  <Ionicons
                    name="warning-outline"
                    size={26}
                    color={colors.white}
                  />
                </View>
                <View style={estilos.textosAlertas}>
                  <Text style={estilos.tituloAlertas}>Alertas Críticas</Text>
                  <Text style={estilos.subtituloAlertas}>
                    Requieren revisión prioritaria
                  </Text>
                </View>
                <Pressable
                  onPress={irAReportes}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={estilos.enlace}>Ver todas ›</Text>
                </Pressable>
              </View>
              {resumen.alertasCriticas.length === 0 ? (
                <Text style={estilos.vacio}>
                  No hay barreras críticas pendientes. ¡Buen trabajo!
                </Text>
              ) : (
                resumen.alertasCriticas.map((alerta) => {
                  // Alta: barrera crítica ya corroborada por la comunidad.
                  const alta = alerta.confirmaciones >= 1;
                  return (
                    <Pressable
                      key={alerta.idReporte}
                      onPress={irAReportes}
                      style={estilos.alerta}
                      accessibilityRole="button"
                      accessibilityLabel={`${alerta.poiNombre}, ${alerta.direccion}. Prioridad ${
                        alta ? 'alta' : 'media'
                      }`}
                    >
                      {alerta.evidencia ? (
                        <Image
                          source={{
                            uri: urlPublicaEvidencia(alerta.evidencia),
                          }}
                          style={estilos.fotoAlerta}
                          accessibilityIgnoresInvertColors
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                      ) : (
                        <View style={[estilos.fotoAlerta, estilos.sinFoto]}>
                          <Ionicons
                            name="image-outline"
                            size={22}
                            color={colors.textMuted}
                          />
                        </View>
                      )}
                      <View style={estilos.textosAlerta}>
                        <Text style={estilos.nombreAlerta} numberOfLines={1}>
                          {alerta.poiNombre}
                        </Text>
                        <View style={estilos.filaIcono}>
                          <Ionicons
                            name="location"
                            size={12}
                            color={colors.navy}
                          />
                          <Text style={estilos.detalleAlerta} numberOfLines={2}>
                            {alerta.direccion || 'Sin dirección'}
                          </Text>
                        </View>
                        <Text style={estilos.detalleAlerta}>
                          Reportado {fechaHoraCorta(alerta.fechaCreacion)}
                        </Text>
                      </View>
                      <View style={estilos.prioridad}>
                        <View
                          style={[
                            estilos.selloPrioridad,
                            alta ? null : estilos.selloMedia,
                          ]}
                        >
                          <Ionicons
                            name="stats-chart"
                            size={11}
                            color={alta ? colors.danger : '#B45309'}
                          />
                          <Text
                            style={[
                              estilos.textoPrioridad,
                              alta ? null : estilos.textoMedia,
                            ]}
                          >
                            {alta ? 'Alta prioridad' : 'Media prioridad'}
                          </Text>
                        </View>
                        <Text style={estilos.confirmaciones}>
                          {alerta.confirmaciones}/3 confirmaciones
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.navy}
                      />
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={estilos.seccion}>
              <View style={estilos.cabeceraSeccion}>
                <Text style={estilos.tituloSeccion}>Actividad reciente</Text>
              </View>
              {resumen.actividadReciente.length === 0 ? (
                <Text style={estilos.vacio}>
                  Aún no hay decisiones de moderación registradas.
                </Text>
              ) : (
                resumen.actividadReciente.map((actividad) => {
                  const aprobado = actividad.accion === 'aprobar';
                  return (
                    <View key={actividad.id} style={estilos.actividad}>
                      <Ionicons
                        name={aprobado ? 'checkmark-circle' : 'close-circle'}
                        size={40}
                        color={aprobado ? colors.success : colors.danger}
                      />
                      <View style={estilos.textosActividad}>
                        <Text style={estilos.tituloActividad}>
                          {ACCION_TEXTO[actividad.accion] ??
                            'Decisión registrada'}
                        </Text>
                        <Text style={estilos.detalleActividad}>
                          {actividad.poiNombre}
                        </Text>
                        <Text style={estilos.detalleActividad}>
                          {haceCuanto(actividad.fecha)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
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
  cabecera: {
    paddingHorizontal: spacing.lg,
  },
  contenido: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  saludo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  textosSaludo: {
    flex: 1,
    gap: spacing.xs,
  },
  hola: {
    fontSize: fontSize.xxl + 4,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  gracias: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
    lineHeight: 20,
  },
  fecha: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
  cargando: {
    marginTop: spacing.xl,
  },
  cifras: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cifra: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 2,
    minHeight: 150,
  },
  iconoCifra: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  valorCifra: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  tituloCifra: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  detalleCifra: {
    fontSize: 11,
    color: colors.navy,
  },
  pieCifra: {
    fontSize: 10,
    color: colors.textSlate,
    marginTop: 'auto',
  },
  alertas: {
    backgroundColor: '#FDF0F0',
    borderWidth: 1,
    borderColor: '#F6D3D3',
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  cabeceraAlertas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xs,
  },
  iconoAlertas: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosAlertas: {
    flex: 1,
  },
  tituloAlertas: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
  subtituloAlertas: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  enlace: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  vacio: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
    padding: spacing.sm,
  },
  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  fotoAlerta: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
  },
  sinFoto: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosAlerta: {
    flex: 1,
    gap: 2,
  },
  nombreAlerta: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  filaIcono: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-start',
  },
  detalleAlerta: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textSlate,
  },
  prioridad: {
    alignItems: 'flex-end',
    gap: 4,
  },
  selloPrioridad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FDE5E5',
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  selloMedia: {
    backgroundColor: '#FDF0DC',
  },
  textoPrioridad: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.danger,
  },
  textoMedia: {
    color: '#B45309',
  },
  confirmaciones: {
    fontSize: 10,
    color: colors.textSlate,
  },
  seccion: {
    gap: spacing.sm,
  },
  cabeceraSeccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  actividad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  textosActividad: {
    flex: 1,
    gap: 2,
  },
  tituloActividad: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  detalleActividad: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  punto: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  puntoTexto: {
    color: colors.white,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
