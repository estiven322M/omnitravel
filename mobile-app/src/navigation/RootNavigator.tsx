import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PoiDetailScreen } from '../screens/PoiDetailScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useProfileStore } from '../store/profileStore';
import { colors } from '../utils/theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navegación raíz con flujo por estado de sesión:
 * sin perfil → Registro; con perfil → pestañas + detalle de POI.
 * El perfil se lee del almacenamiento cifrado del dispositivo (nunca del backend).
 */
export function RootNavigator() {
  const hidratado = useProfileStore((estado) => estado.hidratado);
  const perfil = useProfileStore((estado) => estado.perfil);

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

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {perfil ? (
          <>
            <Stack.Screen name="Principal" component={MainTabs} />
            <Stack.Screen
              name="DetallePoi"
              component={PoiDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          <Stack.Screen name="Registro" component={RegisterScreen} />
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
