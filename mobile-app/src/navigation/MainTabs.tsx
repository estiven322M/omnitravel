import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ContributeScreen } from '../screens/ContributeScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { colors, fontSize, fontWeight } from '../utils/theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Shell de navegación del módulo Viajero/Comunidad.
 * Estructura visual de los mockups: Inicio · Mapa · Contribuir · Guardados · Perfil.
 */
export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs - 1,
          fontWeight: fontWeight.semibold,
        },
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Contribuir"
        component={ContributeScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle" size={34} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Guardados"
        component={SavedScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
