import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import type { RootStackParamList } from '../navigation/types';
import type { IconName } from '../services/types';
import { colors, fontSize, fontWeight, spacing } from '../utils/theme';

const ILUSTRACION = require('../../assets/ilustraciones/splash-ilustracion.jpg');

const PILARES: { icono: IconName; texto: string }[] = [
  { icono: 'map-outline', texto: 'Explora' },
  { icono: 'compass-outline', texto: 'Descubre' },
  { icono: 'people-outline', texto: 'Viaja\nsin límites' },
];

/** U01 — Splash / Presentación. */
export function SplashScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.marca}>
          <BrandMark variante="pin" tamano={150} />
          <Text
            style={estilos.wordmark}
            accessibilityRole="header"
            accessibilityLabel="OmniTravel"
          >
            <Text style={estilos.omni}>Omni</Text>
            <Text style={estilos.travel}>Travel</Text>
          </Text>
          <Text style={estilos.lema}>Tu mundo, sin barreras</Text>
        </View>

        <View style={estilos.pilares}>
          {PILARES.map((pilar) => (
            <View
              key={pilar.texto}
              style={estilos.pilar}
              accessible
              accessibilityLabel={pilar.texto.replace('\n', ' ')}
            >
              <Ionicons name={pilar.icono} size={38} color={colors.primary} />
              <Text style={estilos.pilarTexto}>{pilar.texto}</Text>
            </View>
          ))}
        </View>

        <AppButton
          titulo="Comenzar"
          iconoFinal="arrow-forward"
          onPress={() => navigation.navigate('Login')}
          pistaAccesibilidad="Abre el inicio de sesión"
          estilo={estilos.boton}
        />

        <Text style={estilos.frase}>
          {'Un turismo más inclusivo\nes posible'}
        </Text>

        <Image
          source={ILUSTRACION}
          style={[
            estilos.ilustracion,
            { width, height: Math.round((width * 398) / 727) },
          ]}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no"
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
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  marca: {
    alignItems: 'center',
  },
  wordmark: {
    marginTop: spacing.md,
    fontSize: 46,
    color: colors.primary,
  },
  omni: {
    fontWeight: fontWeight.bold,
    color: '#0B4DB0',
  },
  travel: {
    fontWeight: fontWeight.regular,
    color: '#0B4DB0',
  },
  lema: {
    fontSize: fontSize.lg,
    color: colors.textSlate,
    letterSpacing: 0.5,
  },
  pilares: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  pilar: {
    alignItems: 'center',
    gap: spacing.sm,
    width: 96,
  },
  pilarTexto: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  boton: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
  },
  frase: {
    marginTop: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.textSlate,
    textAlign: 'center',
  },
  ilustracion: {
    marginTop: 'auto',
  },
});
