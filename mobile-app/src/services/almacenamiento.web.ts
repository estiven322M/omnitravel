/**
 * Versión web del almacenamiento seguro (`almacenamiento.ts`).
 *
 * `expo-secure-store` no tiene implementación para navegador: aquí se usa
 * `localStorage`, que pertenece solo a este navegador. Es para probar la app
 * en el computador; en el teléfono los datos siguen cifrados en el
 * Keychain / Keystore. Si el navegador bloquea el almacenamiento (modo
 * privado), la app funciona igual pero sin recordar la sesión.
 */

function almacen(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItemAsync(
  clave: string,
  _opciones?: unknown,
): Promise<string | null> {
  try {
    return almacen()?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(
  clave: string,
  valor: string,
  _opciones?: unknown,
): Promise<void> {
  try {
    almacen()?.setItem(clave, valor);
  } catch {
    // Sin almacenamiento disponible: la sesión no se recordará.
  }
}

export async function deleteItemAsync(
  clave: string,
  _opciones?: unknown,
): Promise<void> {
  try {
    almacen()?.removeItem(clave);
  } catch {
    // Nada que borrar.
  }
}

/** El navegador no ofrece huella / Face ID para el llavero: se oculta. */
export function canUseBiometricAuthentication(): boolean {
  return false;
}
