import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ContributeScreen } from '../screens/ContributeScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SavedScreen } from '../screens/SavedScreen';
import type { IconName } from '../services/types';
import { colors, fontSize, fontWeight } from '../utils/theme';
import { opcionesBarraInferior } from './estiloPestanas';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function icono(activo: IconName, inactivo: IconName) {
  return function IconoPestana({
    color,
    focused,
  }: {
    color: string;
    focused: boolean;
  }) {
    return (
      <Ionicons name={focused ? activo : inactivo} size={24} color={color} />
    );
  };
}

/** Botón central elevado «+ Contribuir» del mockup U04. */
function BotonContribuir({
  onPress,
  accessibilityState,
}: BottomTabBarButtonProps) {
  const activo = accessibilityState?.selected ?? false;
  return (
    <Pressable
      onPress={onPress}
      style={estilos.contenedorCentral}
      accessibilityRole="button"
      accessibilityLabel="Contribuir: crear un reporte"
      accessibilityState={{ selected: activo }}
    >
      <View style={estilos.circulo}>
        <Ionicons name="add" size={34} color={colors.white} />
      </View>
      <Text
        style={[
          estilos.etiquetaCentral,
          activo ? estilos.etiquetaActiva : null,
        ]}
      >
        Contribuir
      </Text>
    </Pressable>
  );
}

/**
 * Pestañas del viajero (mockup U04): Inicio · Mapa · Contribuir · Guardados ·
 * Perfil. Las cuentas de moderación usan su propio panel (ModeradorTabs).
 */
export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={opcionesBarraInferior}>
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ tabBarIcon: icono('home', 'home-outline') }}
      />
      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{ tabBarIcon: icono('map', 'map-outline') }}
      />
      <Tab.Screen
        name="Contribuir"
        component={ContributeScreen}
        options={{ tabBarButton: (props) => <BotonContribuir {...props} /> }}
      />
      <Tab.Screen
        name="Guardados"
        component={SavedScreen}
        options={{ tabBarIcon: icono('heart', 'heart-outline') }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ tabBarIcon: icono('person', 'person-outline') }}
      />
    </Tab.Navigator>
  );
}

const estilos = StyleSheet.create({
  contenedorCentral: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  circulo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  etiquetaCentral: {
    fontSize: fontSize.xs - 1,
    fontWeight: fontWeight.semibold,
    color: colors.textSlate,
    marginTop: 2,
  },
  etiquetaActiva: {
    color: colors.primary,
  },
});
