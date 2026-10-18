/**
 * Cliente HTTP base para el backend OmniTravel (NestJS).
 *
 * - Usa EXPO_PUBLIC_API_URL (ver .env.example).
 * - Timeout de 10 s y errores normalizados para que la UI pueda mostrar
 *   mensajes claros (RNF-17: nunca fallar en silencio).
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TIMEOUT_MS = 10000;

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
): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!respuesta.ok) {
      throw new ApiError(
        `El servidor respondió con estado ${respuesta.status}.`,
        respuesta.status,
      );
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
