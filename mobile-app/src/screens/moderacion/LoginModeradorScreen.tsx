import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { BrandMark } from '../../components/BrandMark';
import type { RootStackParamList } from '../../navigation/types';
import { iniciarSesionCompleta } from '../../services/inicioSesion';
import type { IconName } from '../../services/types';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../../utils/theme';

const ILUSTRACION = require('../../../assets/ilustraciones/moderacion-ciudad.jpg');

function EtiquetaCampo({ icono, texto }: { icono: IconName; texto: string }) {
  return (
    <View style={estilos.etiqueta}>
      <View style={estilos.iconoEtiqueta}>
        <Ionicons name={icono} size={20} color={colors.primary} />
      </View>
      <Text style={estilos.textoEtiqueta}>{texto}</Text>
    </View>
  );
}

/**
 * M01 — Login de Moderador.
 *
 * Solo entran cuentas con rol moderador o administrador en la BD; esas
 * cuentas las crea el equipo con `npm run crear-admin` en el backend (la app
 * nunca permite registrarse con un rol de moderación).
 */
export function LoginModeradorScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingresando, setIngresando] = useState(false);

  const acceder = async () => {
    if (!correo.trim() || !contrasena) {
      setError('Ingresa tu correo corporativo y tu contraseña.');
      return;
    }
    setError(null);
    setIngresando(true);
    try {
      await iniciarSesionCompleta(correo, contrasena, { soloModeracion: true });
    } catch (causa) {
      setError((causa as Error).message);
    } finally {
      setIngresando(false);
    }
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
          <Pressable
            onPress={() => navigation.goBack()}
            style={estilos.atras}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </Pressable>

          <View style={estilos.cabecera}>
            <BrandMark variante="completo" tamano={58} />
            <Text style={estilos.titulo} accessibilityRole="header">
              Panel de Moderación
            </Text>
            <Text style={estilos.subtitulo}>
              Gestiona, revisa y valida los aportes de la comunidad para un
              turismo más accesible e inclusivo.
            </Text>
          </View>

          <Image
            source={ILUSTRACION}
            style={estilos.ilustracion}
            resizeMode="cover"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />

          <View style={estilos.tarjeta}>
            <EtiquetaCampo icono="mail-outline" texto="Correo Corporativo" />
            <TextInput
              style={estilos.input}
              value={correo}
              onChangeText={setCorreo}
              placeholder="usuario@omnitravel.edu.co"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Correo corporativo"
            />

            <EtiquetaCampo icono="lock-closed-outline" texto="Contraseña" />
            <View style={estilos.inputConIcono}>
              <TextInput
                style={[estilos.input, estilos.inputFlexible]}
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!verContrasena}
                autoComplete="current-password"
                accessibilityLabel="Contraseña"
              />
              <Pressable
                onPress={() => setVerContrasena((visible) => !visible)}
                style={estilos.ojo}
                accessibilityRole="button"
                accessibilityLabel={
                  verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                <Ionicons
                  name={verContrasena ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color={colors.textSlate}
                />
              </Pressable>
            </View>

            {error ? (
              <Text style={estilos.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <AppButton
              titulo="Acceder al sistema"
              icono="shield-checkmark-outline"
              onPress={() => void acceder()}
              cargando={ingresando}
              forma="redondeado"
              estilo={estilos.boton}
            />

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Recuperar contraseña',
                  'Pide al administrador de OmniTravel que restablezca tu contraseña.',
                )
              }
              accessibilityRole="button"
              style={estilos.olvido}
            >
              <Text style={estilos.enlace}>¿Olvidaste tu contraseña?</Text>
            </Pressable>

            <View style={estilos.linea} />

            <View style={estilos.aviso}>
              <Ionicons name="shield" size={30} color={colors.primary} />
              <View style={estilos.textosAviso}>
                <Text style={estilos.avisoTitulo}>
                  Acceso exclusivo para moderadores autorizados.
                </Text>
                <Text style={estilos.avisoTexto}>
                  Todos los accesos son registrados y monitoreados para
                  garantizar la seguridad de la información.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  contenido: {
    paddingBottom: spacing.xl,
  },
  atras: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  cabecera: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  titulo: {
    marginTop: spacing.lg,
    fontSize: fontSize.xxl + 2,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
    textAlign: 'center',
    lineHeight: 20,
  },
  ilustracion: {
    width: '100%',
    height: 130,
    marginTop: spacing.sm,
  },
  tarjeta: {
    marginTop: -spacing.lg,
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  iconoEtiqueta: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoEtiqueta: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  inputConIcono: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlexible: {
    flex: 1,
    paddingRight: TOUCH_TARGET,
  },
  ojo: {
    position: 'absolute',
    right: 0,
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
  boton: {
    marginTop: spacing.md,
    minHeight: 54,
  },
  olvido: {
    alignSelf: 'center',
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  enlace: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  linea: {
    height: 1,
    backgroundColor: colors.border,
  },
  aviso: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: '#EEF3FA',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  textosAviso: {
    flex: 1,
    gap: 2,
  },
  avisoTitulo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  avisoTexto: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    lineHeight: 17,
  },
});
