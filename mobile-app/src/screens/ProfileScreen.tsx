import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FilterSheet } from '../components/FilterSheet';
import type { RootStackParamList } from '../navigation/types';
import {
  borrarFotoDePerfil,
  elegirFotoDePerfil,
  FotoPerfilError,
  uriFotoDePerfilGuardada,
} from '../services/fotoPerfil';
import { listarMisReportes } from '../services/reportes';
import type { ReporteResumen } from '../services/types';
import {
  useProfileStore,
  type NecesidadAccesibilidad,
} from '../store/profileStore';
import { cerrarSesionCompleta } from '../services/sesion';
import {
  calcularPuntos,
  nivelComunitario,
  progresoNivel,
  textoSiguienteNivel,
} from '../utils/gamificacion';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  shadow,
  spacing,
} from '../utils/theme';

const ETIQUETAS_NECESIDAD: Record<NecesidadAccesibilidad, string> = {
  movilidad_reducida: 'Movilidad reducida',
  silla_de_ruedas: 'Uso de silla de ruedas',
  visual: 'Discapacidad visual',
};

/**
 * U12 — Perfil.
 *
 * - Avatar con foto elegida desde la galería: se copia al almacenamiento
 *   privado del dispositivo y nunca viaja al servidor (Ley 1581).
 * - Puntos y nivel comunitarios calculados con la actividad real (reportes
 *   propios y confirmaciones recibidas de la BD).
 * - «Mis reportes» con el estado de validación de cada aporte.
 * - Accesos rápidos a configuración de accesibilidad y privacidad.
 */
export function ProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const perfil = useProfileStore((estado) => estado.perfil);
  const establecerFoto = useProfileStore((estado) => estado.establecerFoto);
  /** Cuenta dueña del perfil: elige el archivo de foto propio en pantalla. */
  const idCuenta = useProfileStore((estado) => estado.perfil?.idCuenta);
  const filtrosActivos = useProfileStore(
    (estado) => estado.perfil?.filtrosActivos ?? [],
  );
  const establecerFiltros = useProfileStore(
    (estado) => estado.establecerFiltros,
  );

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [privacidadVisible, setPrivacidadVisible] = useState(false);
  const [reportes, setReportes] = useState<ReporteResumen[] | null>(null);
  const [errorReportes, setErrorReportes] = useState<string | null>(null);
  const [cambiandoFoto, setCambiandoFoto] = useState(false);

  // Refresca la actividad cada vez que la pestaña vuelve al foco.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      listarMisReportes()
        .then((lista) => {
          if (vigente) {
            setReportes(lista);
            setErrorReportes(null);
          }
        })
        .catch((error) => {
          if (vigente) {
            setErrorReportes(
              (error as Error)?.message ??
                'No pudimos cargar tu actividad comunitaria.',
            );
          }
        });
      return () => {
        vigente = false;
      };
    }, []),
  );

  const resumen = useMemo(() => {
    const lista = reportes ?? [];
    return {
      reportesCreados: lista.length,
      publicados: lista.filter((reporte) => reporte.estado === 'publicado')
        .length,
      barreras: lista.filter((reporte) => reporte.esCritico).length,
      confirmacionesRecibidas: lista.reduce(
        (suma, reporte) => suma + reporte.confirmaciones,
        0,
      ),
    };
  }, [reportes]);

  const puntos = calcularPuntos(resumen);
  const nivel = nivelComunitario(puntos);
  const progreso = progresoNivel(puntos);

  const anunciar = (mensaje: string) => {
    // Los avisos usan liveRegion en Android (evitamos doble anuncio).
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(mensaje);
    }
  };

  // Red de seguridad: si el perfil llegó sin foto pero existe el archivo
  // propio de esta cuenta (p. ej. perfil antiguo hidratado), se recupera.
  useEffect(() => {
    if (!idCuenta || perfil?.fotoUri) {
      return;
    }
    const uriGuardada = uriFotoDePerfilGuardada(idCuenta);
    if (uriGuardada) {
      establecerFoto(uriGuardada);
    }
  }, [idCuenta, perfil?.fotoUri, establecerFoto]);

  const cambiarFoto = async () => {
    if (!idCuenta) {
      Alert.alert(
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
        anunciar('Foto de perfil actualizada en este dispositivo.');
      }
    } catch (error) {
      Alert.alert(
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
    Alert.alert(
      'Quitar foto',
      'Tu foto se eliminará de este dispositivo. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            if (idCuenta) {
              borrarFotoDePerfil(idCuenta);
            }
            establecerFoto(undefined);
            anunciar('Foto de perfil eliminada.');
          },
        },
      ],
    );
  };

  const confirmarCierre = () => {
    Alert.alert(
      'Cerrar sesión',
      'Tu perfil de accesibilidad se eliminará de este dispositivo. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            // Borra también el token de sesión del dispositivo.
            void cerrarSesionCompleta();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.barraSuperior}>
          <BrandMark tamano={40} variante="completo" />
          <Pressable
            onPress={() =>
              Alert.alert(
                'OmniTravel',
                'Tu mundo, sin barreras. Los ajustes generales de la app llegarán en una próxima iteración; mientras tanto, todo se configura desde este perfil.',
              )
            }
            style={estilos.botonAjustes}
            accessibilityRole="button"
            accessibilityLabel="Ajustes generales"
            accessibilityHint="Muestra información de la aplicación"
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={estilos.encabezado}>
          <Text style={estilos.titulo} accessibilityRole="header">
            Mi Perfil
          </Text>
          <Text style={estilos.subtitulo}>
            Gracias por ser parte de una comunidad que construye un turismo más
            accesible.
          </Text>
        </View>

        <View style={estilos.filaUsuario}>
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
            accessibilityHint="Abre la galería del teléfono"
            style={estilos.contenedorAvatar}
          >
            {perfil?.fotoUri ? (
              <Image
                source={{ uri: perfil.fotoUri }}
                style={estilos.avatarFoto}
                accessibilityIgnoresInvertColors
                accessibilityLabel="Tu foto de perfil"
              />
            ) : (
              <View style={estilos.avatar}>
                {cambiandoFoto ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons
                    name="person-outline"
                    size={38}
                    color={colors.primary}
                  />
                )}
              </View>
            )}
            <View style={estilos.botonCamara}>
              <Ionicons name="pencil" size={14} color={colors.white} />
            </View>
          </Pressable>

          <View style={estilos.textosUsuario}>
            <Text style={estilos.nombre}>
              {perfil?.nombre ?? 'Viajero OmniTravel'}
            </Text>
            <View style={estilos.chipNivel}>
              <Ionicons name="sparkles" size={13} color={colors.success} />
              <Text style={estilos.textoNivel}>{nivel.nombre}</Text>
            </View>
            <Text style={estilos.fraseNivel}>{nivel.frase}</Text>

            <Text style={estilos.puntos}>{puntos} puntos comunitarios</Text>
            <View
              style={estilos.barraProgreso}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={textoSiguienteNivel(puntos)}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(progreso * 100),
              }}
            >
              <View
                style={[estilos.progreso, { width: `${progreso * 100}%` }]}
              />
            </View>
            <Text style={estilos.textoSiguiente}>
              {textoSiguienteNivel(puntos)}
            </Text>
          </View>
        </View>

        {perfil && perfil.necesidades.length > 0 ? (
          <View style={estilos.necesidades}>
            {perfil.necesidades.map((necesidad) => (
              <Chip key={necesidad} etiqueta={ETIQUETAS_NECESIDAD[necesidad]} />
            ))}
          </View>
        ) : null}

        <View style={estilos.filaEstadisticas}>
          <View style={estilos.tarjetaEstadistica}>
            <View style={[estilos.iconoEstadistica, estilos.fondoVerde]}>
              <Ionicons name="location" size={18} color={colors.success} />
            </View>
            <Text style={estilos.etiquetaEstadistica}>Lugares validados</Text>
            <Text style={estilos.valorEstadistica}>{resumen.publicados}</Text>
            <Text style={estilos.detalleEstadistica}>
              Ayudas a descubrir lugares accesibles
            </Text>
          </View>

          <View style={estilos.tarjetaEstadistica}>
            <View style={[estilos.iconoEstadistica, estilos.fondoNaranja]}>
              <Ionicons name="warning" size={18} color={colors.warning} />
            </View>
            <Text style={estilos.etiquetaEstadistica}>Barreras reportadas</Text>
            <Text style={estilos.valorEstadistica}>{resumen.barreras}</Text>
            <Text style={estilos.detalleEstadistica}>
              Contribuyes a un entorno más seguro
            </Text>
          </View>

          <View style={estilos.tarjetaEstadistica}>
            <View style={[estilos.iconoEstadistica, estilos.fondoAzul]}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <Text style={estilos.etiquetaEstadistica}>Personas ayudadas</Text>
            <Text style={estilos.valorEstadistica}>
              {resumen.confirmacionesRecibidas}
            </Text>
            <Text style={estilos.detalleEstadistica}>
              Tu información beneficia a otros
            </Text>
          </View>
        </View>

        {errorReportes ? (
          <View style={estilos.aviso} accessibilityLiveRegion="polite">
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color={colors.warning}
            />
            <Text style={estilos.textoAviso}>{errorReportes}</Text>
          </View>
        ) : null}

        {reportes === null && !errorReportes ? (
          <Text style={estilos.textoProceso}>
            Leyendo tu actividad comunitaria…
          </Text>
        ) : null}

        <View style={estilos.filaSeccion}>
          <Text style={estilos.tituloSeccion}>Mi actividad</Text>
          <Pressable
            onPress={() => navigation.navigate('MisReportes')}
            accessibilityRole="button"
            accessibilityLabel="Ver historial de mis reportes"
            style={estilos.enlaceHistorial}
          >
            <Text style={estilos.textoEnlace}>Ver historial</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('MisReportes')}
          accessibilityRole="button"
          accessibilityHint="Consulta y gestiona tus lugares y barreras reportadas"
          style={({ pressed }) => [
            estilos.filaActividad,
            pressed ? estilos.presionado : null,
          ]}
        >
          <View style={[estilos.iconoActividad, estilos.fondoAzul]}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={estilos.textosActividad}>
            <Text style={estilos.tituloActividad}>Mis reportes</Text>
            <Text style={estilos.descripcionActividad}>
              Consulta y gestiona tus lugares y barreras reportadas.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setFiltrosAbiertos(true)}
          accessibilityRole="button"
          accessibilityLabel="Configuración de Accesibilidad"
          accessibilityHint="Personaliza la app según tus necesidades"
          style={({ pressed }) => [
            estilos.filaActividad,
            pressed ? estilos.presionado : null,
          ]}
        >
          <View style={[estilos.iconoActividad, estilos.fondoVerde]}>
            <Ionicons
              name="accessibility-outline"
              size={20}
              color={colors.success}
            />
          </View>
          <View style={estilos.textosActividad}>
            <Text style={estilos.tituloActividad}>
              Configuración de Accesibilidad
            </Text>
            <Text style={estilos.descripcionActividad}>
              {filtrosActivos.length > 0
                ? `${filtrosActivos.length} filtros guardados desde el mapa.`
                : 'Personaliza la app según tus necesidades.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setPrivacidadVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityHint="Gestiona tu información y privacidad"
          accessibilityState={{ expanded: privacidadVisible }}
          style={({ pressed }) => [
            estilos.filaActividad,
            pressed ? estilos.presionado : null,
          ]}
        >
          <View style={[estilos.iconoActividad, estilos.fondoLila]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#6D4AC4"
            />
          </View>
          <View style={estilos.textosActividad}>
            <Text style={estilos.tituloActividad}>
              Ajustes de Privacidad (Datos Locales)
            </Text>
            <Text style={estilos.descripcionActividad}>
              Gestiona tu información y privacidad.
            </Text>
          </View>
          <Ionicons
            name={privacidadVisible ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        {privacidadVisible ? (
          <Card estilo={estilos.tarjetaPrivacidad}>
            <View style={estilos.filaAjuste}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.success}
              />
              <Text style={estilos.textoPrivacidad}>
                Tu perfil de accesibilidad, tus filtros y tu foto se guardan
                cifrados en este dispositivo y nunca se envían al servidor (Ley
                1581).
              </Text>
            </View>
            <View style={estilos.filaAjuste}>
              <Ionicons
                name="cloud-upload-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={estilos.textoPrivacidad}>
                Solo viajan al servidor los reportes que decides publicar en la
                comunidad (lugar, foto de evidencia y descripción).
              </Text>
            </View>
            {perfil?.fotoUri ? (
              <AppButton
                titulo="Eliminar mi foto de este dispositivo"
                variante="contorno"
                icono="trash-outline"
                onPress={quitarFoto}
                pistaAccesibilidad="Borra la foto guardada localmente"
              />
            ) : null}
          </Card>
        ) : null}

        <AppButton
          titulo="Cerrar sesión"
          variante="contorno"
          icono="log-out-outline"
          onPress={confirmarCierre}
          pistaAccesibilidad="Elimina el perfil local de este dispositivo"
        />
      </ScrollView>

      <FilterSheet
        visible={filtrosAbiertos}
        filtrosActivos={filtrosActivos}
        onAplicar={establecerFiltros}
        onCerrar={() => setFiltrosAbiertos(false)}
      />
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
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonAjustes: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 20,
  },
  filaUsuario: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  contenedorAvatar: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFoto: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
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
  textosUsuario: {
    flex: 1,
    gap: spacing.xs,
  },
  nombre: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  chipNivel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  textoNivel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  fraseNivel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  puntos: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  barraProgreso: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progreso: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  textoSiguiente: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  necesidades: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filaEstadisticas: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tarjetaEstadistica: {
    flex: 1,
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  iconoEstadistica: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fondoVerde: {
    backgroundColor: colors.successSoft,
  },
  fondoNaranja: {
    backgroundColor: colors.warningSoft,
  },
  fondoAzul: {
    backgroundColor: colors.primarySoft,
  },
  fondoLila: {
    backgroundColor: '#EFEAFB',
  },
  etiquetaEstadistica: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  valorEstadistica: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  detalleEstadistica: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  textoAviso: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  textoProceso: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  filaSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  tituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  enlaceHistorial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
  },
  textoEnlace: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  filaActividad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  presionado: {
    opacity: 0.9,
  },
  iconoActividad: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosActividad: {
    flex: 1,
    gap: 2,
  },
  tituloActividad: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  descripcionActividad: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  tarjetaPrivacidad: {
    backgroundColor: colors.surface,
    shadowOpacity: 0,
    elevation: 0,
    gap: spacing.sm,
  },
  filaAjuste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textoPrivacidad: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    lineHeight: 17,
  },
});
