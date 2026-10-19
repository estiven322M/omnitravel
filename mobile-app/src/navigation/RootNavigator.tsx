import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useVigilanciaSesion } from '../hooks/useVigilanciaSesion';
import { LoginScreen } from '../screens/LoginScreen';
import { IncidenciasScreen } from '../screens/moderacion/IncidenciasScreen';
import { LoginModeradorScreen } from '../screens/moderacion/LoginModeradorScreen';
import { RevisionReporteScreen } from '../screens/moderacion/RevisionReporteScreen';
import { NotificacionesScreen } from '../screens/NotificacionesScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { esRolModeracion } from '../services/inicioSesion';
import { MisReportesScreen } from '../screens/MisReportesScreen';
import { NavegacionScreen } from '../screens/NavegacionScreen';
import { PoiDetailScreen } from '../screens/PoiDetailScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useProfileStore } from '../store/profileStore';
import { colors } from '../utils/theme';
import { MainTabs } from './MainTabs';
import { ModeradorTabs } from './ModeradorTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navegación raíz con flujo por estado de sesión:
 * sin perfil → Login (pantalla inicial) con Registro alcanzable; con perfil →
 * pestañas + detalle de POI. El perfil se lee del almacenamiento cifrado del
 * dispositivo (nunca del backend), por lo que la sesión se conserva entre
 * aperturas y no hace falta registrarse de nuevo.
 */
export function RootNavigator() {
  const hidratado = useProfileStore((estado) => estado.hidratado);
  const perfil = useProfileStore((estado) => estado.perfil);
  useVigilanciaSesion(hidratado);

  if (!hidratado) {
    return (
      <View
        style={estilos.carga}
        accessible
        accessibilityLabel="Cargando OmniTravel"
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const moderacion = esRolModeracion(perfil?.rol);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {perfil ? (
          <>
            {moderacion ? (
              <Stack.Screen name="PanelModerador" component={ModeradorTabs} />
            ) : (
              <Stack.Screen name="Principal" component={MainTabs} />
            )}
            <Stack.Screen
              name="DetallePoi"
              component={PoiDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Notificaciones"
              component={NotificacionesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="MisReportes"
              component={MisReportesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Navegacion"
              component={NavegacionScreen}
              options={{ animation: 'slide_from_right' }}
            />
            {moderacion ? (
              <>
                <Stack.Screen
                  name="RevisionReporte"
                  component={RevisionReporteScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="Incidencias"
                  component={IncidenciasScreen}
                  options={{ animation: 'slide_from_right' }}
                />
              </>
            ) : null}
          </>
        ) : (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Registro"
              component={RegisterScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="LoginModerador"
              component={LoginModeradorScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const estilos = StyleSheet.create({
  carga: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
