import * as SecureStore from 'expo-secure-store';

/**
 * Ingreso con huella / Face ID (U02).
 *
 * Tras un inicio de sesión con contraseña, la persona puede activar el
 * ingreso biométrico: las credenciales se guardan en el llavero del sistema
 * (Keychain / Keystore) con `requireAuthentication`, así que el sistema
 * operativo exige la huella o el rostro cada vez que se leen. Nunca salen
 * del teléfono ni se envían a otro lugar que no sea `POST /auth/login`.
 */

const CLAVE_CREDENCIALES = 'omnitravel-credenciales-biometricas';

export interface CredencialesGuardadas {
  email: string;
  contrasena: string;
}

/** ¿El dispositivo tiene biometría configurada y el llavero la soporta? */
export function biometriaDisponible(): boolean {
  try {
    return SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

/** ¿Hay credenciales protegidas guardadas? (no pide la huella). */
export async function biometriaActivada(): Promise<boolean> {
  try {
    // Leer pediría la huella: se consulta la marca sin protección.
    return (
      (await SecureStore.getItemAsync(`${CLAVE_CREDENCIALES}-marca`)) === '1'
    );
  } catch {
    return false;
  }
}

export async function activarBiometria(
  credenciales: CredencialesGuardadas,
): Promise<void> {
  await SecureStore.setItemAsync(
    CLAVE_CREDENCIALES,
    JSON.stringify(credenciales),
    {
      requireAuthentication: true,
      authenticationPrompt: 'Confirma para activar el ingreso con huella',
    },
  );
  await SecureStore.setItemAsync(`${CLAVE_CREDENCIALES}-marca`, '1');
}

/** Pide la huella / el rostro y devuelve las credenciales (null si se cancela). */
export async function leerCredencialesBiometricas(): Promise<CredencialesGuardadas | null> {
  try {
    const crudo = await SecureStore.getItemAsync(CLAVE_CREDENCIALES, {
      requireAuthentication: true,
      authenticationPrompt:
        'Usa tu huella o tu rostro para entrar a OmniTravel',
    });
    if (!crudo) {
      return null;
    }
    const datos = JSON.parse(crudo) as Partial<CredencialesGuardadas>;
    return typeof datos.email === 'string' &&
      typeof datos.contrasena === 'string'
      ? { email: datos.email, contrasena: datos.contrasena }
      : null;
  } catch {
    return null;
  }
}

export async function desactivarBiometria(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_CREDENCIALES).catch(() => undefined);
  await SecureStore.deleteItemAsync(`${CLAVE_CREDENCIALES}-marca`).catch(
    () => undefined,
  );
}
