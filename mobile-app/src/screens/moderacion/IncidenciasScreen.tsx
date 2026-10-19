import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alerta } from '../../utils/alerta';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AvatarInicial,
  EncabezadoMarca,
  InsigniaModerador,
} from '../../components/EncabezadoMarca';
import type { RootStackParamList } from '../../navigation/types';
import { fotoDePoi } from '../../services/mocks/fotosPoi';
import {
  desactivarPuntoDeIncidencia,
  listarIncidencias,
  solicitarNuevaEvidencia,
  type Gravedad,
  type Incidencia,
} from '../../services/moderacion';
import { useModeracionStore } from '../../store/moderacionStore';
import { useProfileStore } from '../../store/profileStore';
import { fechaHoraCorta } from '../../utils/moderacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from '../../utils/theme';

type Filtro = 'todas' | Gravedad;

const GRAVEDAD: Record<
  Gravedad,
  { texto: string; color: string; fondo: string }
> = {
  alta: { texto: 'Alta', color: colors.danger, fondo: '#FDECEC' },
  media: { texto: 'Media', color: '#C2410C', fondo: '#FDF0DC' },
  baja: { texto: 'Baja', color: '#A16207', fondo: '#FEF9C3' },
};

/** M06 — Gestión de incidencias post-viaje (Proceso 3). */
export function IncidenciasScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const perfil = useProfileStore((estado) => estado.perfil);
  const marcarCambio = useModeracionStore((estado) => estado.marcarCambio);
  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setIncidencias(await listarIncidencias());
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

  const conteo = useMemo(() => {
    const lista = incidencias ?? [];
    return {
      todas: lista.length,
      alta: lista.filter((i) => i.gravedad === 'alta').length,
      media: lista.filter((i) => i.gravedad === 'media').length,
      baja: lista.filter((i) => i.gravedad === 'baja').length,
    };
  }, [incidencias]);

  const visibles = (incidencias ?? []).filter(
    (incidencia) => filtro === 'todas' || incidencia.gravedad === filtro,
  );

  const ejecutar = (
    incidencia: Incidencia,
    accion: 'desactivar' | 'evidencia',
  ) => {
    const desactivar = accion === 'desactivar';
    Alerta.alert(
      desactivar ? 'Desactivar punto del mapa' : 'Solicitar nueva evidencia',
      desactivar
        ? `«${incidencia.poi.nombre}» saldrá del mapa público hasta que se verifique de nuevo.`
        : `La comunidad recibirá una solicitud para volver a verificar «${incidencia.poi.nombre}».`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: desactivar ? 'Desactivar' : 'Solicitar',
          style: desactivar ? 'destructive' : 'default',
          onPress: () => {
            setProcesando(incidencia.id);
            void (
              desactivar
                ? desactivarPuntoDeIncidencia(incidencia.id)
                : solicitarNuevaEvidencia(incidencia.id)
            )
              .then(() => {
                marcarCambio();
                return cargar();
              })
              .catch((causa: Error) =>
                Alerta.alert('No se pudo completar', causa.message),
              )
              .finally(() => setProcesando(null));
          },
        },
      ],
    );
  };

  const FILTROS: { id: Filtro; texto: string; punto?: string }[] = [
    { id: 'todas', texto: `Todas (${conteo.todas})` },
    {
      id: 'alta',
      texto: `Alta gravedad (${conteo.alta})`,
      punto: colors.danger,
    },
    { id: 'media', texto: `Media (${conteo.media})`, punto: '#F97316' },
    { id: 'baja', texto: `Baja (${conteo.baja})`, punto: '#EAB308' },
  ];

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
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
        <Text style={estilos.titulo} accessibilityRole="header">
          Incidencias y Re-verificaciones
        </Text>
        <Text style={estilos.subtitulo}>
          Reportes de viajeros que indican discrepancias en puntos ya
          publicados. Revisa y toma las acciones necesarias.
        </Text>
        <View style={estilos.aviso}>
          <Ionicons name="warning" size={30} color={colors.warning} />
          <Text style={estilos.avisoTexto}>
            Estas incidencias pueden indicar cambios en la infraestructura,
            información incorrecta o uso indebido. Tu revisión ayuda a mantener
            la confiabilidad del mapa.
          </Text>
        </View>
        <View style={estilos.chips}>
          {FILTROS.map((opcion) => {
            const activo = filtro === opcion.id;
            return (
              <Pressable
                key={opcion.id}
                onPress={() => setFiltro(opcion.id)}
                style={[estilos.chip, activo ? estilos.chipActivo : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                {opcion.punto ? (
                  <View
                    style={[estilos.punto, { backgroundColor: opcion.punto }]}
                  />
                ) : null}
                <Text style={estilos.chipTexto}>{opcion.texto}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={estilos.error}>{error}</Text> : null}
      {!incidencias && !error ? (
        <ActivityIndicator color={colors.primary} style={estilos.cargando} />
      ) : null}

      <FlatList
        data={visibles}
        keyExtractor={(incidencia) => incidencia.id}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          incidencias ? (
            <Text style={estilos.vacio}>
              No hay incidencias abiertas. ¡Todo en orden!
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const gravedad = GRAVEDAD[item.gravedad];
          const ocupado = procesando === item.id;
          return (
            <View style={estilos.tarjeta}>
              <View style={estilos.fila}>
                <Image
                  source={fotoDePoi(item.poi.nombre, item.poi.tipo).fuente}
                  style={estilos.foto}
                  accessibilityElementsHidden
                />
                <View style={estilos.cuerpo}>
                  <Text style={estilos.nombre} numberOfLines={1}>
                    {item.poi.nombre}
                  </Text>
                  <View style={estilos.filaIcono}>
                    <Ionicons
                      name="location"
                      size={12}
                      color={colors.textSlate}
                    />
                    <Text style={estilos.detalle} numberOfLines={1}>
                      {item.poi.direccion || 'Sin dirección'}
                    </Text>
                  </View>
                  <View style={estilos.comentario}>
                    <Ionicons name="chatbox" size={13} color="#9A3412" />
                    <Text style={estilos.comentarioTexto}>
                      {item.comentario || item.descripcion}
                    </Text>
                  </View>
                  <Text style={estilos.detalle}>
                    Reportado por: {item.autor ?? 'Cuenta eliminada'} |{' '}
                    {fechaHoraCorta(item.fechaCreacion)}
                  </Text>
                  {item.estado === 'en_proceso' ? (
                    <Text style={estilos.enProceso}>
                      Re-verificación solicitada
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    estilos.gravedad,
                    { backgroundColor: gravedad.fondo },
                  ]}
                >
                  <Ionicons name="warning" size={13} color={gravedad.color} />
                  <Text
                    style={[estilos.gravedadTexto, { color: gravedad.color }]}
                  >
                    {gravedad.texto}
                  </Text>
                  <Text
                    style={[estilos.gravedadSub, { color: gravedad.color }]}
                  >
                    Gravedad
                  </Text>
                </View>
              </View>
              <View style={estilos.acciones}>
                <Pressable
                  onPress={() => ejecutar(item, 'desactivar')}
                  disabled={ocupado}
                  style={[estilos.accion, estilos.accionDesactivar]}
                  accessibilityRole="button"
                  accessibilityLabel={`Desactivar ${item.poi.nombre} del mapa`}
                >
                  <Ionicons name="ban" size={18} color={colors.danger} />
                  <Text style={estilos.textoDesactivar}>
                    Desactivar punto del mapa
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => ejecutar(item, 'evidencia')}
                  disabled={ocupado || item.estado === 'en_proceso'}
                  style={[
                    estilos.accion,
                    estilos.accionEvidencia,
                    item.estado === 'en_proceso' ? estilos.inactivo : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Solicitar nueva evidencia de ${item.poi.nombre}`}
                >
                  <Ionicons name="people" size={18} color={colors.primary} />
                  <Text style={estilos.textoEvidencia}>
                    Solicitar nueva evidencia a la comunidad
                  </Text>
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
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  titulo: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: { fontSize: fontSize.sm, color: colors.textSlate, lineHeight: 19 },
  aviso: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: '#FEF4E8',
    borderWidth: 1,
    borderColor: '#F8D9B5',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  avisoTexto: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#9A3412',
    lineHeight: 17,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 34,
  },
  chipActivo: { backgroundColor: '#FDF0DC', borderColor: '#F59E0B' },
  chipTexto: { fontSize: 11, color: colors.navy },
  punto: { width: 8, height: 8, borderRadius: 4 },
  error: { color: colors.danger, padding: spacing.lg },
  cargando: { marginTop: spacing.xl },
  lista: { padding: spacing.lg, gap: spacing.md },
  vacio: {
    textAlign: 'center',
    color: colors.textSlate,
    marginTop: spacing.xl,
  },
  tarjeta: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fila: { flexDirection: 'row', gap: spacing.sm },
  foto: { width: 76, height: 76, borderRadius: radii.sm },
  cuerpo: { flex: 1, gap: 3 },
  nombre: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detalle: { flexShrink: 1, fontSize: 10, color: colors.textSlate },
  comentario: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#FDECEC',
    borderRadius: radii.sm,
    padding: 6,
  },
  comentarioTexto: { flex: 1, fontSize: 11, color: '#9A3412' },
  enProceso: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  gravedad: {
    alignItems: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  gravedadTexto: { fontSize: 11, fontWeight: fontWeight.bold },
  gravedadSub: { fontSize: 9 },
  acciones: { flexDirection: 'row', gap: spacing.sm },
  accion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.2,
    borderRadius: radii.sm,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  accionDesactivar: { borderColor: '#F59E8B', backgroundColor: '#FFF7F5' },
  accionEvidencia: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  inactivo: { opacity: 0.5 },
  textoDesactivar: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.danger,
    fontWeight: fontWeight.medium,
  },
  textoEvidencia: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
