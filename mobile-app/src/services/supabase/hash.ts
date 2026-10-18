import * as Crypto from 'expo-crypto';

/**
 * Hashea la contraseña con SHA256 (mismo algoritmo que el front web del
 * equipo, CryptoJS.SHA256) para poder comparar contra la columna
 * `usuarios.password`.
 */
export async function hashearContrasena(texto: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, texto);
}
