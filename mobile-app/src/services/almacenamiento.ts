/**
 * Almacenamiento seguro del dispositivo (Keychain en iOS / Keystore en
 * Android) para el token de sesión, el perfil y las credenciales biométricas.
 *
 * En el navegador (`almacenamiento.web.ts`) se usa el almacenamiento del
 * navegador, porque `expo-secure-store` no existe en web.
 */
export {
  canUseBiometricAuthentication,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';
