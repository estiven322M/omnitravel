import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EncabezadoMarca } from '../components/EncabezadoMarca';
import type { RootStackParamList } from '../navigation/types';
import { usaPanelModeracion } from '../services/inicioSesion';
import { fotoDePoi } from '../services/mocks/fotosPoi';
import { obtenerResumenModeracion } from '../services/moderacion';
import {
  listarBarrerasComunitarias,
  listarMisReportes,
} from '../services/reportes';
import type { IconName } from '../services/types';
import { usePoisStore } from '../store/poisStore';
import { useProfileStore } from '../store/profileStore';
import { haceCuanto } from '../utils/moderacion';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

type Tono = 'exito' | 'alerta' | 'info' | 'neutro' | 'bienvenida';

interface Notificacion {
  id: string;
  tono: Tono;
  icono: IconName;
  titulo: string;
  texto: string;
  fecha: string;
  foto?: ImageSourcePropType;
  onPress?: () => void;
}

const TONOS: Record<
  Tono,
  { fondo: string; borde: string; icono: string; titulo: string }
> = {
  exito: {
    fondo: '#EAF6EF',
    borde: '#CDE8D6',
    icono: colors.success,
    titulo: colors.success,
  },
  alerta: {
    fondo: '#FEF4E8',
    borde: '#F8D9B5',
    icono: colors.warning,
    titulo: '#9A3412',
  },
  info: {
    fondo: '#EAF2FC',
    borde: '#CFE0F6',
    icono: colors.primary,
    titulo: colors.primary,
  },
  neutro: {
    fondo: colors.white,
    borde: colors.border,
    icono: colors.primary,
    titulo: colors.navy,
  },
  bienvenida: {
    fondo: colors.white,
    borde: colors.border,
    icono: '#EC4E6A',
    titulo: colors.navy,
  },
};

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * U11 — Notificaciones. Se arman con datos reales: el estado de tus reportes,
 * las barreras recientes de la comunidad y, para moderación, lo pendiente.
 */
export function NotificacionesScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const perfil = useProfileStore((estado) => estado.perfil);
  const poiPorId = usePoisStore((estado) => estado.poiPorId);
  const [grupos, setGrupos] = useState<{
    hoy: Notificacion[];
    anteriores: Notificacion[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enPanelModeracion = usaPanelModeracion(perfil);
  const creadoEn = perfil?.creadoEn;

  const cargar = async () => {
    try {
      const notificaciones: Notificacion[] = [];
      const nombreDe = (poiId: string) =>
        poiPorId(poiId)?.nombre ?? `Lugar #${poiId}`;

      if (enPanelModeracion) {
        const resumen = await obtenerResumenModeracion();
        resumen.alertasCriticas.forEach((alerta) =>
          notificaciones.push({
            id: `alerta-${alerta.idReporte}`,
            tono: 'alerta',
            icono: 'warning',
            titulo: 'Barrera crítica por revisar',
            texto: `${alerta.poiNombre}: ${alerta.confirmaciones}/3 confirmaciones de la comunidad.`,
            fecha: alerta.fechaCreacion,
            onPress: () =>
              navigation.navigate('PanelModerador', {
                screen: 'ReportesModerador',
              }),
          }),
        );
        if (resumen.discrepancias > 0) {
          notificaciones.push({
            id: 'discrepancias',
            tono: 'info',
            icono: 'people',
            titulo: `${resumen.discrepancias} discrepancias post-viaje`,
            texto:
              'Viajeros reportaron diferencias con lo publicado. Revísalas en Incidencias.',
            fecha: new Date().toISOString(),
            onPress: () => navigation.navigate('Incidencias'),
          });
        }
      } else {
        const [mios, barreras] = await Promise.all([
          listarMisReportes().catch(() => []),
          listarBarrerasComunitarias().catch(() => []),
        ]);
        mios.forEach((reporte) => {
          const nombre = nombreDe(reporte.poiId);
          const poi = poiPorId(reporte.poiId);
          const foto = poi
            ? fotoDePoi(poi.nombre, poi.categoria).fuente
            : undefined;
          const abrir = () =>
            navigation.navigate('DetallePoi', { poiId: reporte.poiId });
          if (reporte.estado === 'publicado') {
            notificaciones.push({
              id: `r-${reporte.id}`,
              tono: 'exito',
              icono: 'checkmark-circle',
              titulo: '¡Tu reporte alcanzó 3 confirmaciones y fue publicado!',
              texto: `${nombre}. Gracias por contribuir a un entorno más accesible.`,
              fecha: reporte.fechaCreacion,
              foto,
              onPress: abrir,
            });
          } else if (reporte.estado === 'rechazado') {
            notificaciones.push({
              id: `r-${reporte.id}`,
              tono: 'alerta',
              icono: 'close-circle',
              titulo: 'Tu reporte no fue publicado',
              texto: `${nombre}. Puedes revisar el motivo y enviar uno nuevo.`,
              fecha: reporte.fechaCreacion,
              onPress: () => navigation.navigate('MisReportes'),
            });
          } else {
            notificaciones.push({
              id: `r-${reporte.id}`,
              tono: 'info',
              icono: 'people',
              titulo: 'Tu reporte está en revisión',
              texto: `${nombre}: ${reporte.confirmaciones}/3 confirmaciones de la comunidad.`,
              fecha: reporte.fechaCreacion,
              onPress: abrir,
            });
          }
        });
        barreras.slice(0, 3).forEach((barrera) =>
          notificaciones.push({
            id: `b-${barrera.id}`,
            tono: 'alerta',
            icono: 'warning',
            titulo: 'Alerta de desvío',
            texto: `Reportaron una barrera en ${nombreDe(barrera.poiId)}. Te sugerimos rutas alternativas.`,
            fecha: barrera.fechaCreacion,
            onPress: () =>
              navigation.navigate('DetallePoi', { poiId: barrera.poiId }),
          }),
        );
      }

      if (creadoEn) {
        notificaciones.push({
          id: 'bienvenida',
          tono: 'bienvenida',
          icono: 'heart',
          titulo: '¡Bienvenido a OmniTravel!',
          texto:
            'Gracias por ser parte de esta comunidad por un turismo más inclusivo.',
          fecha: creadoEn,
        });
      }

      notificaciones.sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );
      const ahora = Date.now();
      setGrupos({
        hoy: notificaciones.filter(
          (n) => ahora - new Date(n.fecha).getTime() < UN_DIA,
        ),
        anteriores: notificaciones.filter(
          (n) => ahora - new Date(n.fecha).getTime() >= UN_DIA,
        ),
      });
      setError(null);
    } catch (causa) {
      setError((causa as Error).message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void cargar();
      // Recarga solo al enfocar la pantalla.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const hoy = grupos?.hoy ?? [];
  const anteriores = grupos?.anteriores ?? [];
  const total = hoy.length + anteriores.length;

  const renderizar = (notificacion: Notificacion) => {
    const tono = TONOS[notificacion.tono];
    const destacada =
      notificacion.tono !== 'neutro' && notificacion.tono !== 'bienvenida';
    return (
      <Pressable
        key={notificacion.id}
        onPress={notificacion.onPress}
        disabled={!notificacion.onPress}
        style={[
          estilos.tarjeta,
          {
            backgroundColor: destacada ? tono.fondo : colors.white,
            borderColor: tono.borde,
          },
        ]}
        accessibilityRole={notificacion.onPress ? 'button' : undefined}
        accessibilityLabel={`${notificacion.titulo}. ${notificacion.texto}. ${haceCuanto(notificacion.fecha)}`}
      >
        <View
          style={[
            estilos.icono,
            { backgroundColor: destacada ? tono.icono : `${tono.icono}22` },
          ]}
        >
          <Ionicons
            name={notificacion.icono}
            size={26}
            color={destacada ? colors.white : tono.icono}
          />
        </View>
        <View style={estilos.textos}>
          <Text style={[estilos.titulo, { color: tono.titulo }]}>
            {notificacion.titulo}
          </Text>
          <Text style={estilos.texto}>{notificacion.texto}</Text>
          <Text style={estilos.fecha}>{haceCuanto(notificacion.fecha)}</Text>
        </View>
        {notificacion.foto ? (
          <Image
            source={notificacion.foto}
            style={estilos.foto}
            accessibilityIgnoresInvertColors
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        {notificacion.onPress ? (
          <Ionicons name="chevron-forward" size={20} color={colors.navy} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.cabecera}>
        <EncabezadoMarca
          tamanoLogo={38}
          onAtras={
            navigation.canGoBack() ? () => navigation.goBack() : undefined
          }
          derecha={
            <View>
              <Ionicons name="notifications" size={26} color={colors.primary} />
              {total > 0 ? (
                <View style={estilos.punto}>
                  <Text style={estilos.puntoTexto}>
                    {Math.min(hoy.length || total, 9)}
                  </Text>
                </View>
              ) : null}
            </View>
          }
        />
      </View>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View>
          <Text style={estilos.encabezado} accessibilityRole="header">
            Notificaciones
          </Text>
          <Text style={estilos.subtitulo}>
            Mantente al día con las novedades de tu comunidad.
          </Text>
        </View>
        {error ? <Text style={estilos.error}>{error}</Text> : null}
        {!grupos && !error ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}
        {grupos && total === 0 ? (
          <Text style={estilos.vacio}>No tienes notificaciones por ahora.</Text>
        ) : null}
        {hoy.length > 0 ? (
          <>
            <Text style={estilos.seccion}>Hoy</Text>
            {hoy.map(renderizar)}
          </>
        ) : null}
        {anteriores.length > 0 ? (
          <>
            <Text style={estilos.seccion}>Anteriores</Text>
            {anteriores.map(renderizar)}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg },
  contenido: { padding: spacing.lg, gap: spacing.sm },
  encabezado: {
    fontSize: fontSize.xxl + 4,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: { fontSize: fontSize.sm, color: colors.textSlate },
  error: { color: colors.danger },
  vacio: {
    color: colors.textSlate,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  seccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    marginTop: spacing.sm,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  icono: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 3 },
  titulo: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  texto: { fontSize: fontSize.xs, color: colors.textSlate, lineHeight: 17 },
  fecha: { fontSize: 11, color: colors.textSlate },
  foto: { width: 64, height: 56, borderRadius: radii.sm },
  punto: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoTexto: {
    color: colors.white,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
