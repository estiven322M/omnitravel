import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { listarReportesModeracion } from '../../services/reportes';
import type { ReporteModeracion } from '../../services/types';
import { useModeracionStore } from '../../store/moderacionStore';
import { useProfileStore } from '../../store/profileStore';
import {
  dimensionDeReporte,
  fechaHoraCorta,
  ICONO_DIMENSION,
  tipoDeReporte,
  type Dimension,
} from '../../utils/moderacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from '../../utils/theme';

type Filtro = 'Todos' | Dimension;
const FILTROS: Filtro[] = ['Todos', 'Motriz', 'Sensorial', 'Cognitiva', 'Otra'];

/** M03 — Lista de reportes pendientes con filtros por dimensión y orden. */
export function ReportesPendientesScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const perfil = useProfileStore((estado) => estado.perfil);
  const seleccionar = useModeracionStore((estado) => estado.seleccionar);

  const [reportes, setReportes] = useState<ReporteModeracion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [recientesPrimero, setRecientesPrimero] = useState(true);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setReportes(await listarReportesModeracion('pendiente_validacion'));
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

  const visibles = useMemo(() => {
    const lista = (reportes ?? []).filter(
      (reporte) =>
        filtro === 'Todos' || dimensionDeReporte(reporte.valores) === filtro,
    );
    return [...lista].sort((a, b) => {
      const diferencia =
        new Date(b.fechaCreacion).getTime() -
        new Date(a.fechaCreacion).getTime();
      return recientesPrimero ? diferencia : -diferencia;
    });
  }, [reportes, filtro, recientesPrimero]);

  const abrir = (reporte: ReporteModeracion) => {
    seleccionar(reporte);
    navigation.navigate('RevisionReporte');
  };

  const total = reportes?.length ?? 0;

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.cabecera}>
        <EncabezadoMarca
          tamanoLogo={34}
          onAtras={
            navigation.canGoBack()
              ? () => navigation.goBack()
              : () =>
                  navigation.navigate('PanelModerador', {
                    screen: 'InicioModerador',
                  })
          }
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
        <Text style={estilos.titulo} accessibilityRole="header">
          Pendientes de Revisión
        </Text>
        <Text style={estilos.subtitulo}>
          Reportes de la comunidad que requieren tu validación.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.chips}
        >
          {FILTROS.map((opcion) => {
            const activo = filtro === opcion;
            const etiqueta = opcion === 'Todos' ? `Todos (${total})` : opcion;
            return (
              <Pressable
                key={opcion}
                onPress={() => setFiltro(opcion)}
                style={[estilos.chip, activo ? estilos.chipActivo : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Filtrar: ${etiqueta}`}
              >
                {opcion !== 'Todos' ? (
                  <Ionicons
                    name={ICONO_DIMENSION[opcion]}
                    size={15}
                    color={activo ? colors.primary : colors.textSlate}
                  />
                ) : null}
                <Text
                  style={[
                    estilos.chipTexto,
                    activo ? estilos.chipTextoActivo : null,
                  ]}
                >
                  {etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => setRecientesPrimero((actual) => !actual)}
          style={estilos.orden}
          accessibilityRole="button"
          accessibilityLabel={`Orden: ${recientesPrimero ? 'más recientes' : 'más antiguos'}. Toca para cambiar`}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.navy} />
          <Text style={estilos.ordenTexto}>
            {recientesPrimero ? 'Más recientes' : 'Más antiguos'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.navy} />
        </Pressable>
      </View>

      {error ? <Text style={estilos.error}>{error}</Text> : null}
      {!reportes && !error ? (
        <ActivityIndicator color={colors.primary} style={estilos.cargando} />
      ) : null}

      <FlatList
        data={visibles}
        keyExtractor={(reporte) => reporte.id}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl
            refreshing={recargando}
            onRefresh={() => {
              setRecargando(true);
              void cargar().finally(() => setRecargando(false));
            }}
          />
        }
        ListEmptyComponent={
          reportes ? (
            <Text style={estilos.vacio}>
              No hay reportes pendientes con este filtro.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const tipo = tipoDeReporte(item.esCritico);
          const dimension = dimensionDeReporte(item.valores);
          const foto = item.evidencia.find((e) => e.storageKey !== '');
          return (
            <View style={estilos.tarjeta}>
              {foto ? (
                <Image
                  source={{ uri: urlPublicaEvidencia(foto.storageKey) }}
                  style={estilos.foto}
                  accessibilityRole="image"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`Evidencia del reporte de ${item.poi.nombre}`}
                />
              ) : (
                <View style={[estilos.foto, estilos.sinFoto]}>
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={colors.textMuted}
                  />
                </View>
              )}
              <View style={estilos.cuerpo}>
                <Text style={estilos.nombre} numberOfLines={1}>
                  {item.poi.nombre}
                </Text>
                <View style={estilos.filaIcono}>
                  <Ionicons name={tipo.icono} size={14} color={tipo.color} />
                  <Text style={[estilos.tipo, { color: tipo.color }]}>
                    {tipo.texto}
                  </Text>
                </View>
                <View style={estilos.filaIcono}>
                  <Ionicons
                    name="location"
                    size={13}
                    color={colors.textSlate}
                  />
                  <Text style={estilos.detalle} numberOfLines={2}>
                    {item.poi.direccion || 'Sin dirección'}
                  </Text>
                </View>
                <View style={estilos.filaIcono}>
                  <Ionicons
                    name="calendar-outline"
                    size={12}
                    color={colors.textSlate}
                  />
                  <Text style={estilos.detalle}>
                    {fechaHoraCorta(item.fechaCreacion)}
                  </Text>
                  <View style={estilos.dimension}>
                    <Ionicons
                      name={ICONO_DIMENSION[dimension]}
                      size={11}
                      color={colors.danger}
                    />
                    <Text style={estilos.dimensionTexto}>{dimension}</Text>
                  </View>
                </View>
              </View>
              <View style={estilos.acciones}>
                <View style={estilos.estado}>
                  <Ionicons name="time" size={13} color="#B45309" />
                  <Text style={estilos.estadoTexto}>Pendiente</Text>
                </View>
                <Pressable
                  onPress={() => abrir(item)}
                  style={estilos.revisar}
                  accessibilityRole="button"
                  accessibilityLabel={`Revisar evidencia de ${item.poi.nombre}`}
                >
                  <Text style={estilos.revisarTexto}>Revisar evidencia</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
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
    gap: spacing.xs,
  },
  titulo: {
    marginTop: spacing.sm,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  chipActivo: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipTexto: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  chipTextoActivo: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  orden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  ordenTexto: {
    fontSize: fontSize.xs,
    color: colors.navy,
  },
  error: {
    color: colors.danger,
    padding: spacing.lg,
  },
  cargando: {
    marginTop: spacing.xl,
  },
  lista: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  vacio: {
    textAlign: 'center',
    color: colors.textSlate,
    marginTop: spacing.xl,
  },
  tarjeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  foto: {
    width: 70,
    height: 86,
    borderRadius: radii.sm,
  },
  sinFoto: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuerpo: {
    flex: 1,
    gap: 3,
  },
  nombre: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  filaIcono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tipo: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  detalle: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textSlate,
  },
  dimension: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FDECEC',
    borderRadius: radii.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  dimensionTexto: {
    fontSize: 10,
    color: colors.danger,
  },
  acciones: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FDF0DC',
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  estadoTexto: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: fontWeight.semibold,
  },
  revisar: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  revisarTexto: {
    color: colors.white,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
});
