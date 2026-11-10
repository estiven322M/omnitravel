import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';
import { AppButton } from './AppButton';

/** Versión que se envía y queda en la auditoría del registro (backend). */
export const VERSION_POLITICA_DATOS = '1.0 (10/11/2026)';

/** Secciones de la política de tratamiento de datos (Ley 1581 de 2012). */
export const SECCIONES_POLITICA: { titulo: string; texto: string }[] = [
  {
    titulo: 'Responsable',
    texto:
      'OmniTravel es un proyecto académico de Ingeniería de Software III de la Universidad del Quindío. El equipo del proyecto es responsable del tratamiento de los datos que se recogen en la aplicación.',
  },
  {
    titulo: 'Datos que se recogen',
    texto:
      'Tu nombre, tu correo electrónico y tu contraseña (guardada cifrada con bcrypt); los reportes, confirmaciones, denuncias, visitas y calificaciones que hagas, con su fecha; las fotos de evidencia que subas y la ubicación de los lugares que reportas.',
  },
  {
    titulo: 'Datos sensibles: se quedan en tu teléfono',
    texto:
      'Tu perfil de accesibilidad (tipo de discapacidad y necesidades) y tus filtros se guardan cifrados SOLO en tu dispositivo. Nunca se envían a nuestros servidores; el cálculo de rutas solo recibe restricciones anónimas (por ejemplo, «evitar escaleras»).',
  },
  {
    titulo: 'Finalidad',
    texto:
      'Mostrarte lugares y rutas accesibles, validar la información con la comunidad, atender incidencias y mantener la seguridad de las cuentas (registro de inicios de sesión y de acciones de moderación).',
  },
  {
    titulo: 'Tus derechos',
    texto:
      'Puedes conocer, actualizar y rectificar tus datos, pedir su supresión y revocar esta autorización, salvo que exista un deber legal de conservarlos. Para ejercerlos, escribe al equipo del proyecto OmniTravel.',
  },
  {
    titulo: 'Seguridad y conservación',
    texto:
      'La información viaja cifrada (HTTPS) y se guarda en AWS (región Ohio, EE. UU.) con copias de seguridad. Tus aportes públicos se muestran sin tu correo ni tus datos personales.',
  },
];

interface Props {
  visible: boolean;
  onCerrar: () => void;
  onAceptar: () => void;
}

/** U03 — Política de tratamiento de datos personales (Ley 1581 de 2012). */
export function PoliticaDatos({ visible, onCerrar, onAceptar }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCerrar}
      accessibilityViewIsModal
    >
      <SafeAreaView style={estilos.pantalla} edges={['top', 'bottom']}>
        <View style={estilos.barra}>
          <Text style={estilos.titulo} accessibilityRole="header">
            Política de tratamiento de datos
          </Text>
          <Pressable
            onPress={onCerrar}
            style={estilos.cerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar la política"
          >
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.version}>
            Ley 1581 de 2012 · Versión {VERSION_POLITICA_DATOS}
          </Text>
          {SECCIONES_POLITICA.map((seccion) => (
            <View key={seccion.titulo} style={estilos.seccion}>
              <Text style={estilos.subtitulo} accessibilityRole="header">
                {seccion.titulo}
              </Text>
              <Text style={estilos.texto}>{seccion.texto}</Text>
            </View>
          ))}
          <AppButton
            titulo="Acepto la política"
            icono="checkmark"
            onPress={onAceptar}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  titulo: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  cerrar: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: { padding: spacing.lg, gap: spacing.md },
  version: { fontSize: fontSize.sm, color: colors.textSecondary },
  seccion: { gap: spacing.xs },
  subtitulo: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  texto: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 21 },
});
