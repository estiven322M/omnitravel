import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccessibilityValueRow } from '../components/AccessibilityValueRow';
import { AppButton } from '../components/AppButton';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import type { RootStackParamList } from '../navigation/types';
import { CATALOGO_CARACTERISTICAS } from '../services/mocks/catalog';
import { getPoiPorId } from '../services/mocks/pois';
import { formatearFechaCorta } from '../utils/format';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

function Estrellas({ calificacion }: { calificacion: number }) {
  return (
    <View
      style={estilos.estrellas}
      accessible
      accessibilityLabel={`Calificación ${calificacion} de 5`}
    >
      {[1, 2, 3, 4, 5].map((indice) => (
        <Ionicons
          key={indice}
          name={indice <= Math.round(calificacion) ? 'star' : 'star-outline'}
          size={14}
          color={colors.warning}
        />
      ))}
    </View>
  );
}

/**
 * U08 — Detalle del Lugar Turístico.
 * Ficha de accesibilidad renderizada dinámicamente según el catálogo
 * (tipoValor booleano/numérico/texto) + estado de verificación comunitaria.
 */
export function PoiDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DetallePoi'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const poi = getPoiPorId(route.params.poiId);

  if (!poi) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EmptyState
          icono="alert-circle-outline"
          titulo="Lugar no encontrado"
          descripcion="No pudimos cargar la información de este lugar."
          textoBoton="Volver"
          onPressBoton={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const verificado = poi.estadoVerificacion === 'VERIFICADO';

  const validarInformacion = () => {
    Alert.alert(
      'Validar información',
      'El flujo de validación comunitaria (confirmaciones) llega en la siguiente iteración (U09–U10).',
    );
  };

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
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.heroe}>
          <Ionicons name="accessibility" size={56} color={colors.primary} />
          <Text style={estilos.heroeNota}>
            Foto del lugar (llegará desde el servicio de evidencias)
          </Text>
        </View>

        <View style={estilos.encabezado}>
          <Text style={estilos.nombre}>{poi.nombre}</Text>
          <View style={estilos.filaCalificacion}>
            <Estrellas calificacion={poi.calificacion} />
            <Text style={estilos.calificacion}>
              {poi.calificacion.toFixed(1)} ({poi.totalExperiencias})
            </Text>
          </View>
          <Text style={estilos.subtitulo}>
            {poi.categoria} · {poi.ciudad}
          </Text>
          <View style={estilos.filaDireccion}>
            <Ionicons
              name="location-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={estilos.direccion}>{poi.direccion}</Text>
          </View>
        </View>

        <Card estilo={estilos.tarjetaVerificacion}>
          <View style={estilos.filaVerificacion}>
            <View style={estilos.iconoVerificacion}>
              <Ionicons
                name={verificado ? 'shield-checkmark' : 'time-outline'}
                size={22}
                color={verificado ? colors.success : colors.warning}
              />
            </View>
            <View style={estilos.textosVerificacion}>
              <Text style={estilos.tituloVerificacion}>
                {verificado
                  ? 'Accesibilidad Verificada'
                  : 'En revisión por la comunidad'}
              </Text>
              <Text style={estilos.detalleVerificacion}>
                {poi.confirmaciones} confirmaciones de la comunidad
              </Text>
              <Text style={estilos.detalleVerificacion}>
                Última verificación:{' '}
                {formatearFechaCorta(poi.ultimaVerificacion)}
              </Text>
            </View>
            <Badge
              tono={verificado ? 'exito' : 'alerta'}
              texto={verificado ? 'Verificado' : 'Pendiente'}
            />
          </View>
        </Card>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>
            Características de accesibilidad
          </Text>
          <Card>
            {CATALOGO_CARACTERISTICAS.map((caracteristica) => (
              <AccessibilityValueRow
                key={caracteristica.id}
                caracteristica={caracteristica}
                valor={poi.valores.find(
                  (valor) => valor.caracteristicaId === caracteristica.id,
                )}
              />
            ))}
          </Card>
        </View>

        <View style={estilos.botones}>
          <AppButton
            titulo="Cómo llegar (Ruta Segura)"
            icono="navigate-outline"
            onPress={() =>
              navigation.navigate('Principal', {
                screen: 'Mapa',
                params: { destinoPoiId: poi.id },
              })
            }
            estilo={estilos.boton}
          />
          <AppButton
            titulo="Validar información"
            variante="contorno"
            icono="checkmark-done-outline"
            onPress={validarInformacion}
            estilo={estilos.boton}
          />
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>
            Experiencias de otros viajeros
          </Text>
          {poi.experiencias.length === 0 ? (
            <Text style={estilos.sinExperiencias}>
              Aún no hay experiencias registradas para este lugar.
            </Text>
          ) : (
            poi.experiencias.map((experiencia) => (
              <Card key={experiencia.autor} estilo={estilos.tarjetaExperiencia}>
                <View style={estilos.filaExperiencia}>
                  <View style={estilos.avatar}>
                    <Ionicons
                      name="person-circle-outline"
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={estilos.textosExperiencia}>
                    <Text style={estilos.autor}>{experiencia.autor}</Text>
                    <Text style={estilos.perfilExperiencia}>
                      {experiencia.perfil}
                    </Text>
                  </View>
                  <Estrellas calificacion={experiencia.calificacion} />
                </View>
                <Text style={estilos.comentario}>{experiencia.comentario}</Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  barraNavegacion: {
    paddingHorizontal: spacing.md,
  },
  botonAtras: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  heroe: {
    height: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroeNota: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  encabezado: {
    gap: spacing.xs,
  },
  nombre: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  filaCalificacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  estrellas: {
    flexDirection: 'row',
    gap: 2,
  },
  calificacion: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filaDireccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  direccion: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tarjetaVerificacion: {
    backgroundColor: colors.successSoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  filaVerificacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconoVerificacion: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosVerificacion: {
    flex: 1,
    gap: 2,
  },
  tituloVerificacion: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  detalleVerificacion: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  seccion: {
    gap: spacing.sm,
  },
  tituloSeccion: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  botones: {
    gap: spacing.sm,
  },
  boton: {
    width: '100%',
  },
  sinExperiencias: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tarjetaExperiencia: {
    gap: spacing.sm,
  },
  filaExperiencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosExperiencia: {
    flex: 1,
  },
  autor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  perfilExperiencia: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  comentario: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});
