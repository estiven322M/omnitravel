import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alerta } from '../utils/alerta';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import { CampoTexto } from '../components/CampoTexto';
import type { RootStackParamList } from '../navigation/types';
import {
  activarBiometria,
  biometriaActivada,
  biometriaDisponible,
  leerCredencialesBiometricas,
} from '../services/biometria';
import { iniciarSesionCompleta } from '../services/inicioSesion';
import type { IconName } from '../services/types';
import { type ModoIngreso, useProfileStore } from '../store/profileStore';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

const OPCIONES_ROL: {
  modo: ModoIngreso;
  titulo: string;
  ayuda: string;
  icono: IconName;
  iconoActivo: IconName;
}[] = [
  {
    modo: 'viajero',
    titulo: 'Usuario',
    ayuda: 'Entra a explorar lugares accesibles',
    icono: 'person-outline',
    iconoActivo: 'person',
  },
  {
    modo: 'moderacion',
    titulo: 'Moderador',
    ayuda: 'Entra al panel de moderación (requiere permisos)',
    icono: 'shield-checkmark-outline',
    iconoActivo: 'shield-checkmark',
  },
];

interface Errores {
  email?: string;
  contrasena?: string;
}

function anunciar(mensaje: string) {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(mensaje);
  }
}

/**
 * U02 — Inicio de sesión (mockup oficial) con selector de rol.
 *
 * Credenciales contra el backend (`POST /auth/login`, JWT). «Usuario» abre la
 * vista de viajero; «Moderador» abre el panel de moderación solo si el rol de
 * la cuenta en la BD lo permite (si no, se niega el ingreso y se borra el
 * token). Huella y
 * Face ID usan credenciales guardadas en el llavero con autenticación
 * biométrica del sistema (se activan tras el primer ingreso con contraseña).
 */
export function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ultimoEmail = useProfileStore((estado) => estado.ultimoEmail);

  const [email, setEmail] = useState(ultimoEmail ?? '');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [ingresando, setIngresando] = useState(false);
  const [biometriaLista, setBiometriaLista] = useState(false);
  const [modo, setModo] = useState<ModoIngreso>('viajero');
  const [errorIngreso, setErrorIngreso] = useState<string | null>(null);
  const esModeracion = modo === 'moderacion';

  useEffect(() => {
    let vigente = true;
    void biometriaActivada().then((activa) => {
      if (vigente) {
        setBiometriaLista(activa);
      }
    });
    return () => {
      vigente = false;
    };
  }, []);

  /** Ofrece activar la huella después de un ingreso con contraseña. */
  const ofrecerBiometria = (correo: string, clave: string) => {
    if (biometriaLista || !biometriaDisponible()) {
      return;
    }
    Alerta.alert(
      'Ingreso con huella o rostro',
      '¿Quieres entrar la próxima vez con tu huella o Face ID? Tus datos quedan cifrados solo en este teléfono.',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Activar',
          onPress: () => {
            void activarBiometria({ email: correo, contrasena: clave }).catch(
              () =>
                Alerta.alert(
                  'No se pudo activar',
                  'Revisa que tu teléfono tenga una huella o un rostro registrado.',
                ),
            );
          },
        },
      ],
    );
  };

  const entrar = async (
    correo: string,
    clave: string,
    conBiometria: boolean,
  ) => {
    setIngresando(true);
    setErrorIngreso(null);
    try {
      // «Moderador» exige el rol en la BD y abre el panel; «Usuario» abre la
      // vista de viajero (también para cuentas de moderación).
      const { aviso } = await iniciarSesionCompleta(correo, clave, {
        soloModeracion: esModeracion,
      });
      anunciar('Sesión iniciada. Bienvenido de nuevo.');
      if (aviso) {
        Alerta.alert('Sesión iniciada', aviso);
      }
      if (!conBiometria) {
        ofrecerBiometria(correo.trim(), clave);
      }
    } catch (error) {
      const mensaje =
        (error as Error)?.message ?? 'Verifica tu conexión e intenta de nuevo.';
      setErrorIngreso(mensaje);
      anunciar(mensaje);
    } finally {
      setIngresando(false);
    }
  };

  const enviar = () => {
    const nuevosErrores: Errores = {};
    if (!email.trim()) {
      nuevosErrores.email = 'Ingresa tu correo electrónico.';
    }
    if (!contrasena) {
      nuevosErrores.contrasena = 'Ingresa tu contraseña.';
    }
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      anunciar('Hay errores en el formulario. Revisa los campos marcados.');
      return;
    }
    void entrar(email, contrasena, false);
  };

  const entrarConBiometria = async () => {
    if (!biometriaLista) {
      Alerta.alert(
        'Ingreso biométrico',
        biometriaDisponible()
          ? 'Inicia sesión una vez con tu contraseña y activa el ingreso con huella o Face ID.'
          : 'Este teléfono no tiene huella ni rostro registrados. Configúralos en los ajustes del sistema.',
      );
      return;
    }
    const credenciales = await leerCredencialesBiometricas();
    if (credenciales) {
      void entrar(credenciales.email, credenciales.contrasena, true);
    }
  };

  /**
   * El backend aún no envía correos de recuperación: se informa con
   * transparencia en lugar de simular un envío (RNF-17).
   */
  const recuperarContrasena = () => {
    Alerta.alert(
      'Recuperar contraseña',
      'La recuperación por correo todavía no está disponible. Pide a un ' +
        'administrador de OmniTravel que restablezca tu contraseña.',
    );
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={estilos.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
        >
          <View style={estilos.barra}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={estilos.volver}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              disabled={!navigation.canGoBack()}
            >
              <Ionicons name="arrow-back" size={22} color={colors.primary} />
              <Text style={estilos.volverTexto}>Volver</Text>
            </Pressable>
            <View
              style={estilos.idioma}
              accessible
              accessibilityLabel="Idioma: español"
            >
              <Text style={estilos.idiomaTexto}>ES</Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </View>
          </View>

          <View style={estilos.marca}>
            <BrandMark variante="pin" tamano={92} />
            <Text style={estilos.wordmark} accessibilityLabel="OmniTravel">
              <Text style={estilos.omni}>Omni</Text>
              <Text style={estilos.travel}>Travel</Text>
            </Text>
            <Text style={estilos.lema}>Tu mundo, sin barreras</Text>
          </View>

          <View style={estilos.encabezado}>
            <Text style={estilos.titulo} accessibilityRole="header">
              Inicia sesión
            </Text>
            <Text style={estilos.subtitulo}>
              {esModeracion
                ? 'Gestiona y valida los aportes de la comunidad'
                : 'Continúa tu próxima aventura'}
            </Text>
          </View>

          <View
            style={estilos.selectorRol}
            accessibilityRole="radiogroup"
            accessibilityLabel="¿Cómo quieres entrar?"
          >
            {OPCIONES_ROL.map((opcion) => {
              const activa = modo === opcion.modo;
              return (
                <Pressable
                  key={opcion.modo}
                  onPress={() => {
                    setModo(opcion.modo);
                    setErrorIngreso(null);
                  }}
                  style={[
                    estilos.opcionRol,
                    activa ? estilos.opcionRolActiva : null,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activa }}
                  accessibilityLabel={opcion.titulo}
                  accessibilityHint={opcion.ayuda}
                >
                  <Ionicons
                    name={activa ? opcion.iconoActivo : opcion.icono}
                    size={22}
                    color={activa ? colors.white : colors.primary}
                  />
                  <Text
                    style={[
                      estilos.textoRol,
                      activa ? estilos.textoRolActivo : null,
                    ]}
                  >
                    {opcion.titulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={estilos.campos}>
            <CampoTexto
              etiqueta="Email"
              ocultarEtiqueta
              icono="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errores.email}
              grande
            />
            <CampoTexto
              etiqueta="Contraseña"
              ocultarEtiqueta
              icono="lock-closed-outline"
              placeholder="Contraseña"
              value={contrasena}
              onChangeText={setContrasena}
              secureTextEntry={!verContrasena}
              autoComplete="current-password"
              error={errores.contrasena}
              grande
              accesorio={
                <Pressable
                  onPress={() => setVerContrasena((visible) => !visible)}
                  style={estilos.botonOjo}
                  accessibilityRole="button"
                  accessibilityLabel={
                    verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  <Ionicons
                    name={verContrasena ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSlate}
                  />
                </Pressable>
              }
            />
          </View>

          <Pressable
            onPress={recuperarContrasena}
            accessibilityRole="button"
            style={estilos.olvido}
          >
            <Text style={estilos.enlace}>¿Olvidaste tu contraseña?</Text>
          </Pressable>

          {errorIngreso ? (
            <View style={estilos.errorIngreso} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={estilos.textoErrorIngreso}>{errorIngreso}</Text>
            </View>
          ) : null}

          <AppButton
            titulo="Iniciar sesión"
            iconoFinal="arrow-forward"
            onPress={enviar}
            cargando={ingresando}
            pistaAccesibilidad="Abre OmniTravel con tu cuenta"
          />

          <View style={estilos.separador} accessibilityElementsHidden>
            <View style={estilos.linea} />
            <Text style={estilos.separadorTexto}>o</Text>
            <View style={estilos.linea} />
          </View>

          <View style={estilos.biometria}>
            <Pressable
              onPress={() => void entrarConBiometria()}
              style={estilos.botonBiometria}
              accessibilityRole="button"
              accessibilityLabel="Usar huella"
              accessibilityHint="Entra con la huella registrada en este teléfono"
            >
              <Ionicons name="finger-print" size={44} color={colors.primary} />
              <Text style={estilos.textoBiometria}>Usar huella</Text>
            </Pressable>
            <Pressable
              onPress={() => void entrarConBiometria()}
              style={estilos.botonBiometria}
              accessibilityRole="button"
              accessibilityLabel="Usar Face ID"
              accessibilityHint="Entra con el reconocimiento facial de este teléfono"
            >
              <Ionicons name="scan-outline" size={44} color={colors.primary} />
              <Text style={estilos.textoBiometria}>Usar Face ID</Text>
            </Pressable>
          </View>

          <View style={estilos.pie}>
            <View style={estilos.lineaPie} />
            {esModeracion ? (
              <View style={estilos.avisoModeracion}>
                <Ionicons name="shield" size={22} color={colors.primary} />
                <Text style={estilos.textoAvisoModeracion}>
                  Acceso exclusivo para moderadores autorizados. Las cuentas de
                  moderación las crea el equipo de OmniTravel.
                </Text>
              </View>
            ) : (
              <>
                <Text style={estilos.pieTexto}>¿No tienes una cuenta?</Text>
                <Pressable
                  onPress={() => navigation.navigate('Registro')}
                  style={estilos.botonCrear}
                  accessibilityRole="button"
                  accessibilityLabel="Crear una cuenta"
                >
                  <Text style={estilos.textoCrear}>Crear una cuenta</Text>
                </Pressable>
              </>
            )}
          </View>
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
  contenido: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  barra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET,
  },
  volverTexto: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  idioma: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  idiomaTexto: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  marca: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 38,
    marginTop: spacing.xs,
  },
  omni: {
    fontWeight: fontWeight.bold,
    color: '#0B4DB0',
  },
  travel: {
    color: '#0B4DB0',
  },
  lema: {
    fontSize: fontSize.md,
    color: colors.textSlate,
  },
  encabezado: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  titulo: {
    fontSize: fontSize.xxl + 2,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: {
    fontSize: fontSize.md,
    color: colors.textSlate,
    textAlign: 'center',
  },
  campos: {
    gap: spacing.md,
  },
  olvido: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
    minHeight: 32,
    justifyContent: 'center',
  },
  enlace: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  linea: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separadorTexto: {
    color: colors.textSlate,
    fontSize: fontSize.sm,
  },
  biometria: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  botonBiometria: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  textoBiometria: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  pie: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineaPie: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  pieTexto: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
  },
  botonCrear: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xxl + spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCrear: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  errorIngreso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  textoErrorIngreso: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#8A1C1C',
  },
  selectorRol: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: 4,
  },
  opcionRol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radii.sm,
  },
  opcionRolActiva: {
    backgroundColor: colors.primary,
  },
  textoRol: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  textoRolActivo: {
    color: colors.white,
  },
  avisoModeracion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#EEF3FA',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  textoAvisoModeracion: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSlate,
    lineHeight: 17,
  },
  botonOjo: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
});
