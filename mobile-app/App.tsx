import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * Punto de entrada de la aplicación móvil OmniTravel (React Native + Expo).
 * Ver estructura y decisiones en README.md (mobile-app/).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
