import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import { CampoTexto } from '../components/CampoTexto';
import { registrarCuenta } from '../services/api/auth';
import type { IconName } from '../services/types';
import type { RootStackParamList } from '../navigation/types';
import {
  useProfileStore,
  type NecesidadAccesibilidad,
} from '../store/profileStore';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

const NECESIDADES: {
  id: NecesidadAccesibilidad;
  etiqueta: string;
  icono: IconName;
}[] = [
  {
    id: 'movilidad_reducida',
    etiqueta: 'Movilidad reducida',
    icono: 'walk',
  },
  {
    id: 'silla_de_ruedas',
    etiqueta: 'Uso de silla de ruedas',
    icono: 'accessibility',
  },
  { id: 'visual', etiqueta: 'Discapacidad visual', icono: 'eye-outline' },
];

interface Errores {
  nombre?: string;
  email?: string;
  contrasena?: string;
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validarContrasena(contrasena: string): boolean {
  return (
    contrasena.length >= 8 &&
    /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(contrasena) &&
    /\d/.test(contrasena) &&
    /[^A-Za-z0-9\s]/.test(contrasena)
  );
}

/**
 * U03 — Registro y Privacidad (Habeas Data).
 *
 * La cuenta se crea en el backend (`POST /auth/register`, contraseña con
 * bcrypt en la tabla `usuario`) y la sesión queda iniciada con su JWT.
 * El perfil de accesibilidad se guarda cifrado en el dispositivo y NUNCA se
 * envía al servidor (Ley 1581, RNF-07). Configuración en una sola pantalla
 * (RNF-13).
 */
export function RegisterScreen() {
  const guardarPerfil = useProfileStore((estado) => estado.guardarPerfil);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [registrando, setRegistrando] = useState(false);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [necesidades, setNecesidades] = useState<NecesidadAccesibilidad[]>([]);
  const [errores, setErrores] = useState<Errores>({});

  const alternarNecesidad = (id: NecesidadAccesibilidad) => {
    setNecesidades((previas) =>
      previas.includes(id)
        ? previas.filter((necesidad) => necesidad !== id)
        : [...previas, id],
    );
  };

  const enviar = async () => {
    const nuevosErrores: Errores = {};

    if (nombre.trim().length < 3) {
      nuevosErrores.nombre = 'Ingresa tu nombre completo.';
    }
    if (!validarEmail(email.trim())) {
      nuevosErrores.email = 'Ingresa un correo electrónico válido.';
    }
    if (!validarContrasena(contrasena)) {
      nuevosErrores.contrasena =
        'Mínimo 8 caracteres, con letras, números y un símbolo.';
    }

    setErrores(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) {
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          'Hay errores en el formulario. Revisa los campos marcados.',
        );
      }
      return;
    }

    setRegistrando(true);
    try {
      // La cuenta se crea en el backend (PostgreSQL en AWS RDS).
      const resultado = await registrarCuenta({
        nombre: nombre.trim(),
        email: email.trim(),
        contrasena,
      });

      // El perfil de accesibilidad sigue siendo 100 % local (Ley 1581).
      // Id de la cuenta dueña del perfil: la fila `usuario` del backend.
      const idCuenta =
        resultado.perfil?.id_usuario != null
          ? String(resultado.perfil.id_usuario)
          : undefined;
      guardarPerfil({
        nombre: nombre.trim(),
        necesidades,
        filtrosActivos: [],
        rol: 'viajero',
        idCuenta,
      });

      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          'Perfil creado. Bienvenido a OmniTravel.',
        );
      }

      // Aviso informativo (no error), si el backend devuelve alguno.
      if (resultado.aviso) {
        Alert.alert('Cuenta creada', resultado.aviso);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo crear la cuenta',
        (error as Error)?.message ?? 'Verifica tu conexión e intenta de nuevo.',
      );
    } finally {
      setRegistrando(false);
    }
  };

  const irAInicioSesion = () => {
    // Login es la pantalla raíz del flujo sin sesión: si Registro se abrió
    // encima, basta con volver; si no, navega explícitamente.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Login');
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
              onPress={irAInicioSesion}
              style={estilos.volver}
              accessibilityRole="button"
              accessibilityLabel="Volver"
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

          <BrandMark variante="completo" tamano={64} />

          <View style={estilos.encabezado}>
            <Text style={estilos.titulo}>Crea tu cuenta</Text>
            <Text style={estilos.subtitulo}>
              Un viaje más accesible te espera
            </Text>
          </View>

          <View style={estilos.campos}>
            <CampoTexto
              etiqueta="Nombre completo"
              ocultarEtiqueta
              grande
              icono="person-outline"
              placeholder="Nombre completo"
              value={nombre}
              onChangeText={setNombre}
              autoComplete="name"
              error={errores.nombre}
            />
            <CampoTexto
              etiqueta="Email"
              ocultarEtiqueta
              grande
              icono="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errores.email}
            />
            <CampoTexto
              etiqueta="Contraseña"
              ocultarEtiqueta
              grande
              icono="lock-closed-outline"
              placeholder="Contraseña"
              value={contrasena}
              onChangeText={setContrasena}
              secureTextEntry={!verContrasena}
              autoComplete="new-password"
              error={errores.contrasena}
              ayuda="Mínimo 8 caracteres, con letras, números y un símbolo."
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
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              }
            />
          </View>

          <View style={estilos.seccionPerfil}>
            <Text style={estilos.tituloSeccion}>Perfil de Accesibilidad</Text>
            <Text style={estilos.subtituloSeccion}>
              Ayúdanos a personalizar tu experiencia
            </Text>
            <View style={estilos.opciones}>
              {NECESIDADES.map(({ id, etiqueta, icono }) => {
                const activa = necesidades.includes(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => alternarNecesidad(id)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={etiqueta}
                    accessibilityState={{ checked: activa }}
                    style={[
                      estilos.opcion,
                      activa ? estilos.opcionActiva : null,
                    ]}
                  >
                    <Ionicons name={icono} size={30} color={colors.primary} />
                    <Text
                      style={[
                        estilos.opcionTexto,
                        activa ? estilos.opcionTextoActiva : null,
                      ]}
                    >
                      {etiqueta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={estilos.notaOpciones}>
              Puedes seleccionar una o más opciones
            </Text>
          </View>

          <View style={estilos.tarjetaPrivacidad}>
            <View style={estilos.iconoPrivacidad}>
              <Ionicons name="lock-closed" size={40} color={colors.success} />
            </View>
            <View style={estilos.textosPrivacidad}>
              <Text style={estilos.tituloPrivacidad}>
                Privacidad por Diseño
              </Text>
              <Text style={estilos.textoPrivacidad}>
                Tus datos médicos se guardan SOLO en tu teléfono. Nunca en
                nuestros servidores. (Ley 1581)
              </Text>
            </View>
          </View>

          <AppButton
            titulo="Comenzar a explorar"
            iconoFinal="arrow-forward"
            onPress={enviar}
            cargando={registrando}
            pistaAccesibilidad="Crea tu perfil local y abre el mapa de lugares accesibles"
            estilo={estilos.botonPrincipal}
          />

          <View style={estilos.pie}>
            <Text style={estilos.pieTexto}>¿Ya tienes una cuenta?</Text>
            <Pressable
              onPress={irAInicioSesion}
              accessibilityRole="button"
              accessibilityLabel="Iniciar sesión"
            >
              <Text style={estilos.pieEnlace}>Iniciar sesión</Text>
            </Pressable>
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
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  encabezado: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  titulo: {
    fontSize: fontSize.xxl + 2,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  campos: {
    gap: spacing.md,
  },
  etiquetaCampo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  inputContenedor: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  botonOjo: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  textoError: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  textoAyuda: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
    minHeight: 44,
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
  seccionPerfil: {
    gap: spacing.xs,
    backgroundColor: '#F1F6FD',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtituloSeccion: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  opciones: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  opcion: {
    flex: 1,
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  opcionActiva: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  opcionTexto: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.navy,
    textAlign: 'center',
  },
  opcionTextoActiva: {
    color: colors.primary,
  },
  notaOpciones: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tarjetaPrivacidad: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  iconoPrivacidad: {
    width: 44,
    height: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosPrivacidad: {
    flex: 1,
    gap: 2,
  },
  tituloPrivacidad: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  textoPrivacidad: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    lineHeight: 17,
  },
  botonPrincipal: {
    marginTop: spacing.xs,
  },
  pie: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pieTexto: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pieEnlace: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
