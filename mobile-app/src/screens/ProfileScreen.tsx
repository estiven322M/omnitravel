import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import {
  useProfileStore,
  type NecesidadAccesibilidad,
} from '../store/profileStore';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

const ETIQUETAS_NECESIDAD: Record<NecesidadAccesibilidad, string> = {
  movilidad_reducida: 'Movilidad reducida',
  silla_de_ruedas: 'Uso de silla de ruedas',
  visual: 'Discapacidad visual',
};

/**
 * U12 — Perfil.
 * Muestra el perfil local y los ajustes de privacidad (datos que nunca salen
 * del dispositivo). La gamificación completa llega en una siguiente iteración.
 */
export function ProfileScreen() {
  const perfil = useProfileStore((estado) => estado.perfil);
  const cerrarSesion = useProfileStore((estado) => estado.cerrarSesion);

  const confirmarCierre = () => {
    Alert.alert(
      'Cerrar sesión',
      'Tu perfil de accesibilidad se eliminará de este dispositivo. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => cerrarSesion(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.encabezado}>
          <Text style={estilos.titulo}>Mi Perfil</Text>
          <Text style={estilos.subtitulo}>
            Gracias por ser parte de una comunidad que construye un turismo más
            accesible.
          </Text>
        </View>

        <Card>
          <View style={estilos.filaUsuario}>
            <View style={estilos.avatar}>
              <Ionicons
                name="person-outline"
                size={30}
                color={colors.primary}
              />
            </View>
            <View style={estilos.textosUsuario}>
              <Text style={estilos.nombre}>
                {perfil?.nombre ?? 'Viajero OmniTravel'}
              </Text>
              <Text style={estilos.rol}>Explorador de lugares accesibles</Text>
            </View>
          </View>

          {perfil && perfil.necesidades.length > 0 ? (
            <View style={estilos.necesidades}>
              {perfil.necesidades.map((necesidad) => (
                <Chip
                  key={necesidad}
                  etiqueta={ETIQUETAS_NECESIDAD[necesidad]}
                />
              ))}
            </View>
          ) : null}
        </Card>

        <Card>
          <View style={estilos.filaAjuste}>
            <View style={estilos.iconoAjuste}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.success}
              />
            </View>
            <View style={estilos.textosAjuste}>
              <Text style={estilos.tituloAjuste}>
                Ajustes de Privacidad (Datos Locales)
              </Text>
              <Text style={estilos.descripcionAjuste}>
                Tu perfil de accesibilidad y tus filtros se guardan cifrados en
                este dispositivo y nunca se envían al servidor (Ley 1581).
              </Text>
            </View>
          </View>
          <View style={estilos.filaAjuste}>
            <View style={estilos.iconoAjuste}>
              <Ionicons
                name="options-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={estilos.textosAjuste}>
              <Text style={estilos.tituloAjuste}>Filtros activos</Text>
              <Text style={estilos.descripcionAjuste}>
                {perfil && perfil.filtrosActivos.length > 0
                  ? `${perfil.filtrosActivos.length} filtros guardados desde el mapa.`
                  : 'Aún no has guardado filtros de accesibilidad.'}
              </Text>
            </View>
          </View>
        </Card>

        <AppButton
          titulo="Cerrar sesión"
          variante="contorno"
          icono="log-out-outline"
          onPress={confirmarCierre}
          pistaAccesibilidad="Elimina el perfil local de este dispositivo"
        />
      </ScrollView>
    </SafeAreaView>
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
  },
  encabezado: {
    gap: spacing.xs,
  },
  titulo: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filaUsuario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosUsuario: {
    flex: 1,
  },
  nombre: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rol: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  necesidades: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  filaAjuste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconoAjuste: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosAjuste: {
    flex: 1,
    gap: 2,
  },
  tituloAjuste: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  descripcionAjuste: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
});
