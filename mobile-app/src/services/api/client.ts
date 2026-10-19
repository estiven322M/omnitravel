import * as SecureStore from 'expo-secure-store';

/**
 * Cliente HTTP base para el backend OmniTravel (NestJS), única vía de la
 * app hacia la base de datos (PostgreSQL en AWS RDS).
 *
 * - Usa EXPO_PUBLIC_API_URL (ver .env.example).
 * - Adjunta el JWT de sesión (guardado cifrado con expo-secure-store).
 * - Timeout de 10 s y errores normalizados para que la UI pueda mostrar
 *   mensajes claros (RNF-17: nunca fallar en silencio).
 * - Sesión vencida: si el JWT ya expiró, o el backend responde 401 a una
 *   petición autenticada, avisa al manejador registrado (cierra la sesión y
 *   lleva al login) en lugar de dejar la app en un estado a medias.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TIMEOUT_MS = 10000;

/** Clave del token de sesión en el almacenamiento seguro del dispositivo. */
export const CLAVE_TOKEN = 'omnitravel-token';

/** Margen para no enviar un token que expira durante la petición. */
const MARGEN_EXPIRACION_MS = 30_000;

export const MENSAJE_SESION_VENCIDA =
  'Tu sesión venció. Inicia sesión de nuevo para continuar.';

/**
 * ¿El JWT ya expiró (o está mal formado)? Solo lee `exp` del payload: la
 * firma la verifica el backend, aquí basta con no enviar uno caducado.
 */
export function tokenVencido(
  token: string,
  ahora: number = Date.now(),
): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return true;
    }
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(base64)) as { exp?: unknown };
    if (typeof exp !== 'number') {
      return true;
    }
    return exp * 1000 - MARGEN_EXPIRACION_MS <= ahora;
  } catch {
    return true;
  }
}

let manejadorSesionVencida: (() => void) | null = null;

/**
 * Registra quién reacciona a una sesión vencida (la raíz de la app).
 * Devuelve la función para quitar el registro.
 */
export function registrarManejadorSesionVencida(
  manejador: () => void,
): () => void {
  manejadorSesionVencida = manejador;
  return () => {
    if (manejadorSesionVencida === manejador) {
      manejadorSesionVencida = null;
    }
  };
}

/** Login y registro responden 401 por credenciales, no por sesión vencida. */
const RUTAS_SIN_SESION = new Set(['/auth/login', '/auth/register']);

function esRutaDeAutenticacion(path: string): boolean {
  return RUTAS_SIN_SESION.has(path.split('?')[0]);
}

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const guardado = await SecureStore.getItemAsync(CLAVE_TOKEN).catch(
      () => null,
    );
    const autenticada = !esRutaDeAutenticacion(path);
    let token: string | null = null;
    if (guardado && autenticada) {
      if (tokenVencido(guardado)) {
        manejadorSesionVencida?.();
        throw new ApiError(MENSAJE_SESION_VENCIDA, 401);
      }
      token = guardado;
    }
    const respuesta = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (respuesta.status === 401 && token) {
      manejadorSesionVencida?.();
      throw new ApiError(MENSAJE_SESION_VENCIDA, 401);
    }

    if (!respuesta.ok) {
      // NestJS responde con `message` legible (p. ej. validaciones del
      // ruteo); si el cuerpo no es JSON se conserva el mensaje genérico.
      let mensaje = `El servidor respondió con estado ${respuesta.status}.`;
      try {
        const cuerpo = (await respuesta.json()) as { message?: unknown };
        if (typeof cuerpo?.message === 'string' && cuerpo.message.trim()) {
          mensaje = cuerpo.message;
        }
      } catch {
        // Cuerpo no JSON: se mantiene el mensaje genérico.
      }
      throw new ApiError(mensaje, respuesta.status);
    }

    return (await respuesta.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'No fue posible comunicarse con el servidor. Verifica tu conexión e inténtalo de nuevo.',
    );
  } finally {
    clearTimeout(temporizador);
  }
}

export { API_URL };
