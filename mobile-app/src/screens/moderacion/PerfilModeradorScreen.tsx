import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alerta } from '../../utils/alerta';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { CampoTexto } from '../../components/CampoTexto';
import {
  AvatarInicial,
  EncabezadoMarca,
  InsigniaModerador,
} from '../../components/EncabezadoMarca';
import type { RootStackParamList } from '../../navigation/types';
import { cambiarContrasena } from '../../services/api/auth';
import {
  obtenerResumenModeracion,
  type ResumenModeracion,
} from '../../services/moderacion';
import {
  borrarFotoDePerfil,
  elegirFotoDePerfil,
  FotoPerfilError,
} from '../../services/fotoPerfil';
import { cerrarSesionCompleta } from '../../services/sesion';
import type { IconName } from '../../services/types';
import { useProfileStore } from '../../store/profileStore';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from '../../utils/theme';

function Metrica({
  icono,
  color,
  fondo,
  valor,
  titulo,
  detalle,
}: {
  icono: IconName;
  color: string;
  fondo: string;
  valor: string;
  titulo: string;
  detalle: string;
}) {
  return (
    <View
      style={estilos.metrica}
      accessible
      accessibilityLabel={`${titulo}: ${valor}. ${detalle}`}
    >
      <View style={[estilos.iconoMetrica, { backgroundColor: fondo }]}>
        <Ionicons name={icono} size={20} color={color} />
      </View>
      <Text style={estilos.valorMetrica}>{valor}</Text>
      <Text style={estilos.tituloMetrica}>{titulo}</Text>
      <Text style={estilos.detalleMetrica}>{detalle}</Text>
    </View>
  );
}

function OpcionConfiguracion({
  icono,
  texto,
  onPress,
  peligro = false,
}: {
  icono: IconName;
  texto: string;
  onPress: () => void;
  peligro?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[estilos.opcion, peligro ? estilos.opcionPeligro : null]}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      <Ionicons
        name={icono}
        size={20}
        color={peligro ? colors.danger : colors.navy}
      />
      <Text
        style={[estilos.textoOpcion, peligro ? estilos.textoPeligro : null]}
      >
        {texto}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={peligro ? colors.danger : colors.navy}
      />
    </Pressable>
  );
}

/** M07 — Perfil y estadísticas del moderador. */
export function PerfilModeradorScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const perfil = useProfileStore((estado) => estado.perfil);
  const ultimoEmail = useProfileStore((estado) => estado.ultimoEmail);
  const establecerFoto = useProfileStore((estado) => estado.establecerFoto);
  const [cambiandoFoto, setCambiandoFoto] = useState(false);
  const idCuenta = perfil?.idCuenta;

  // Foto de perfil local, igual que en el perfil del viajero (U12).
  const cambiarFoto = async () => {
    if (!idCuenta) {
      Alerta.alert(
        'Foto de perfil',
        'No pudimos identificar tu cuenta. Cierra sesión y vuelve a entrar para poder elegir una foto.',
      );
      return;
    }
    setCambiandoFoto(true);
    try {
      const uri = await elegirFotoDePerfil(idCuenta);
      if (uri) {
        establecerFoto(uri);
        AccessibilityInfo.announceForAccessibility(
          'Foto de perfil actualizada.',
        );
      }
    } catch (error) {
      Alerta.alert(
        'Foto de perfil',
        error instanceof FotoPerfilError
          ? error.message
          : 'No pudimos actualizar tu foto. Inténtalo de nuevo.',
      );
    } finally {
      setCambiandoFoto(false);
    }
  };

  const quitarFoto = () => {
    Alerta.alert('Quitar foto', '¿Quieres quitar tu foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          if (idCuenta) {
            borrarFotoDePerfil(idCuenta);
          }
          establecerFoto(undefined);
        },
      },
    ]);
  };
  const [resumen, setResumen] = useState<ResumenModeracion | null>(null);
  const [claveVisible, setClaveVisible] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [guardandoClave, setGuardandoClave] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void obtenerResumenModeracion()
        .then(setResumen)
        .catch(() => setResumen(null));
    }, []),
  );

  const rolTexto =
    perfil?.rol === 'administrador' ? 'Administrador' : 'Moderador';
  const mes = new Date().toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });
  const desempeno = resumen?.desempeno;
  const variacion =
    desempeno && desempeno.procesadosMesAnterior > 0
      ? Math.round(
          ((desempeno.procesadosMes - desempeno.procesadosMesAnterior) /
            desempeno.procesadosMesAnterior) *
            100,
        )
      : null;

  const guardarClave = async () => {
    setErrorClave(null);
    setGuardandoClave(true);
    try {
      await cambiarContrasena(actual, nueva);
      setClaveVisible(false);
      setActual('');
      setNueva('');
      Alerta.alert(
        'Contraseña actualizada',
        'Úsala la próxima vez que inicies sesión.',
      );
    } catch (causa) {
      setErrorClave((causa as Error).message);
    } finally {
      setGuardandoClave(false);
    }
  };

  const cerrarSesion = () => {
    Alerta.alert('Cerrar sesión', '¿Quieres salir del panel de moderación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => void cerrarSesionCompleta(),
      },
    ]);
  };

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
                accessibilityLabel="Notificaciones"
                hitSlop={8}
              >
                <Ionicons
                  name="notifications"
                  size={24}
                  color={colors.primary}
                />
              </Pressable>
            </>
          }
        />
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        <View>
          <Text style={estilos.titulo} accessibilityRole="header">
            Mi Perfil
          </Text>
          <Text style={estilos.subtitulo}>
            Información de tu cuenta y configuración.
          </Text>
        </View>

        <View style={estilos.tarjetaPerfil}>
          <View style={estilos.columnaAvatar}>
            <Pressable
              onPress={() => void cambiarFoto()}
              onLongPress={perfil?.fotoUri ? quitarFoto : undefined}
              disabled={cambiandoFoto}
              accessibilityRole="button"
              accessibilityLabel={
                perfil?.fotoUri
                  ? 'Cambiar tu foto de perfil'
                  : 'Agregar una foto de perfil'
              }
              accessibilityHint="Abre la galería para elegir una imagen"
            >
              {perfil?.fotoUri ? (
                <Image
                  source={{ uri: perfil.fotoUri }}
                  style={estilos.avatarFoto}
                  accessibilityIgnoresInvertColors
                />
              ) : cambiandoFoto ? (
                <View style={estilos.avatarFoto}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <AvatarInicial
                  texto={perfil?.nombre ?? 'M'}
                  tamano={88}
                  enLinea
                />
              )}
              <View style={estilos.botonCamara}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
            </Pressable>
            {perfil?.fotoUri ? (
              <Pressable
                onPress={quitarFoto}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={estilos.quitarFoto}>Quitar foto</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={estilos.datosPerfil}>
            <Text style={estilos.nombre}>{perfil?.nombre ?? 'Moderador'}</Text>
            <Text style={estilos.rol}>{rolTexto} de Accesibilidad</Text>
            <View style={estilos.filaIcono}>
              <Ionicons
                name="mail-outline"
                size={14}
                color={colors.textSlate}
              />
              <Text style={estilos.dato} numberOfLines={1}>
                {ultimoEmail ?? 'Sin correo'}
              </Text>
            </View>
            <View style={estilos.filaIcono}>
              <Ionicons
                name="business-outline"
                size={14}
                color={colors.textSlate}
              />
              <Text style={estilos.dato}>Equipo de Moderación</Text>
            </View>
          </View>
        </View>

        <View style={estilos.resumen}>
          <View style={estilos.cabeceraResumen}>
            <Ionicons name="bar-chart" size={18} color={colors.navy} />
            <Text style={estilos.tituloResumen}>Resumen de actividad</Text>
            <Text style={estilos.mes}>{mes}</Text>
          </View>
          <View style={estilos.metricas}>
            <Metrica
              icono="checkmark-circle"
              color={colors.success}
              fondo="#E3F6EE"
              valor={desempeno ? `${desempeno.tasaResolucion}%` : '—'}
              titulo="Tasa de resolución"
              detalle="Reportes cerrados satisfactoriamente"
            />
            <Metrica
              icono="document-text"
              color={colors.primary}
              fondo={colors.primarySoft}
              valor={desempeno ? String(desempeno.procesadosMes) : '—'}
              titulo="Reportes procesados este mes"
              detalle={
                variacion === null
                  ? 'Primer mes con registro'
                  : `${variacion >= 0 ? '+' : ''}${variacion}% respecto al mes anterior`
              }
            />
            <Metrica
              icono="time"
              color="#7C3AED"
              fondo="#EFE7FD"
              valor={
                desempeno?.horasPromedio != null
                  ? `${desempeno.horasPromedio} h`
                  : '—'
              }
              titulo="Tiempo promedio de respuesta"
              detalle="Desde el reporte hasta la decisión"
            />
          </View>
        </View>

        <View style={estilos.cabeceraConfig}>
          <Ionicons name="settings-outline" size={20} color={colors.navy} />
          <Text style={estilos.tituloResumen}>Configuración de la cuenta</Text>
        </View>
        <View style={estilos.opciones}>
          <OpcionConfiguracion
            icono="lock-closed-outline"
            texto="Cambiar contraseña"
            onPress={() => setClaveVisible(true)}
          />
          <OpcionConfiguracion
            icono="options-outline"
            texto="Incidencias post-viaje"
            onPress={() => navigation.navigate('Incidencias')}
          />
          <OpcionConfiguracion
            icono="notifications-outline"
            texto="Notificaciones"
            onPress={() => navigation.navigate('Notificaciones')}
          />
          <OpcionConfiguracion
            icono="log-out-outline"
            texto="Cerrar sesión"
            onPress={cerrarSesion}
            peligro
          />
        </View>
      </ScrollView>

      <Modal
        visible={claveVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setClaveVisible(false)}
      >
        <View style={estilos.fondoModal}>
          <View style={estilos.hoja}>
            <Text style={estilos.tituloResumen} accessibilityRole="header">
              Cambiar contraseña
            </Text>
            <CampoTexto
              etiqueta="Contraseña actual"
              icono="lock-closed-outline"
              placeholder="Tu contraseña actual"
              value={actual}
              onChangeText={setActual}
              secureTextEntry
              autoComplete="current-password"
            />
            <CampoTexto
              etiqueta="Nueva contraseña"
              icono="key-outline"
              placeholder="Mínimo 8 caracteres"
              value={nueva}
              onChangeText={setNueva}
              secureTextEntry
              autoComplete="new-password"
              ayuda="Mínimo 8 caracteres, con letras, números y un símbolo."
              error={errorClave ?? undefined}
            />
            <View style={estilos.botonesModal}>
              <AppButton
                titulo="Cancelar"
                variante="contorno"
                forma="redondeado"
                onPress={() => setClaveVisible(false)}
                estilo={estilos.botonModal}
              />
              <AppButton
                titulo="Guardar"
                forma="redondeado"
                onPress={() => void guardarClave()}
                cargando={guardandoClave}
                deshabilitado={!actual || !nueva}
                estilo={estilos.botonModal}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg },
  contenido: { padding: spacing.lg, gap: spacing.lg },
  titulo: {
    fontSize: fontSize.xxl + 4,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: { fontSize: fontSize.sm, color: colors.textSlate },
  tarjetaPerfil: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  datosPerfil: { flex: 1, gap: 3 },
  columnaAvatar: { alignItems: 'center', gap: spacing.xs },
  avatarFoto: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonCamara: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitarFoto: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  nombre: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  rol: { fontSize: fontSize.sm, color: colors.textSlate },
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dato: { flexShrink: 1, fontSize: fontSize.xs, color: colors.textSlate },
  resumen: {
    backgroundColor: '#F4F7FB',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cabeceraResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tituloResumen: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  mes: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    textTransform: 'capitalize',
  },
  metricas: { flexDirection: 'row', gap: spacing.sm },
  metrica: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 3,
  },
  iconoMetrica: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorMetrica: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  tituloMetrica: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  detalleMetrica: { fontSize: 10, color: colors.textSlate },
  cabeceraConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  opciones: { gap: spacing.sm },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  opcionPeligro: { backgroundColor: '#FDF0F0', borderColor: '#F6D3D3' },
  textoOpcion: { flex: 1, fontSize: fontSize.sm, color: colors.navy },
  textoPeligro: { color: colors.danger, fontWeight: fontWeight.semibold },
  fondoModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  botonesModal: { flexDirection: 'row', gap: spacing.sm },
  botonModal: { flex: 1 },
});
