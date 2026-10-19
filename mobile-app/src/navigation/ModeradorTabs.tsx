import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MapScreen } from '../screens/MapScreen';
import { DashboardModeradorScreen } from '../screens/moderacion/DashboardModeradorScreen';
import { EstadisticasModeradorScreen } from '../screens/moderacion/EstadisticasModeradorScreen';
import { PerfilModeradorScreen } from '../screens/moderacion/PerfilModeradorScreen';
import { ReportesPendientesScreen } from '../screens/moderacion/ReportesPendientesScreen';
import type { IconName } from '../services/types';
import { opcionesBarraInferior } from './estiloPestanas';
import type { ModeradorTabParamList } from './types';

const Tab = createBottomTabNavigator<ModeradorTabParamList>();

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

/** Panel de moderación (M02–M07): Inicio · Reportes · Mapa · Estadísticas · Perfil. */
export function ModeradorTabs() {
  return (
    <Tab.Navigator screenOptions={opcionesBarraInferior}>
      <Tab.Screen
        name="InicioModerador"
        component={DashboardModeradorScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: icono('home', 'home-outline'),
        }}
      />
      <Tab.Screen
        name="ReportesModerador"
        component={ReportesPendientesScreen}
        options={{
          tabBarLabel: 'Reportes',
          tabBarIcon: icono('document-text', 'document-text-outline'),
        }}
      />
      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{ tabBarIcon: icono('map', 'map-outline') }}
      />
      <Tab.Screen
        name="Estadisticas"
        component={EstadisticasModeradorScreen}
        options={{
          tabBarLabel: 'Estadísticas',
          tabBarIcon: icono('stats-chart', 'stats-chart-outline'),
        }}
      />
      <Tab.Screen
        name="PerfilModerador"
        component={PerfilModeradorScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: icono('settings', 'settings-outline'),
        }}
      />
    </Tab.Navigator>
  );
}
