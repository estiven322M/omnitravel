import * as SecureStore from '../almacenamiento';
import type { RolUsuario } from '../types';
import { ApiError, apiFetch, CLAVE_TOKEN } from './client';

/**
 * Autenticación contra el backend OmniTravel (`POST /auth/register` y
 * `POST /auth/login`), que guarda las cuentas en la tabla `usuario` de
 * PostgreSQL en AWS RDS con contraseñas bcrypt.
 *
 * El JWT devuelto se guarda cifrado en el dispositivo (expo-secure-store,
 * RNF-08) y `apiFetch` lo adjunta en cada petición. Solo viajan email y
 * contraseña: el perfil de accesibilidad nunca sale del teléfono (Ley 1581).
 */

/** Usuario de dominio que devuelve el backend (tabla `usuario`). */
export interface UsuarioOmniTravel {
  id_usuario: number;
  email: string;
  rol_id: number | null;
  rol: RolUsuario;
}

/** Datos de registro de una cuenta viajero desde la app móvil (U03). */
export interface DatosRegistro {
  nombre: string;
  email: string;
  contrasena: string;
}

export interface ResultadoRegistro {
  email: string;
  perfil: UsuarioOmniTravel | null;
  /** Aviso informativo — no es un error. */
  aviso?: string;
}

export interface ResultadoSesion {
  perfil: UsuarioOmniTravel | null;
  /** Aviso informativo — no es un error. */
  aviso?: string;
}

interface RespuestaSesion {
  token: string;
  usuario: UsuarioOmniTravel;
}

/**
 * Catálogo de roles del dominio (`rol`: 1 viajero, 2 colaborador,
 * 3 establecimiento, 4 moderador, 5 administrador).
 */
const ROLES_POR_ID: Record<number, RolUsuario> = {
  1: 'viajero',
  2: 'colaborador',
  3: 'establecimiento',
  4: 'moderador',
  5: 'administrador',
};

/** Deriva el rol del front desde `usuario.rol_id` (viajero si es desconocido). */
export function rolDeUsuarioId(rolId?: number | null): RolUsuario {
  if (rolId != null && ROLES_POR_ID[rolId]) {
    return ROLES_POR_ID[rolId];
  }
  return 'viajero';
}

/**
 * Quita el código técnico del mensaje del backend (`'CODIGO: texto'`), que
 * las pantallas muestran tal cual a la persona.
 */
export function mensajeLegible(mensaje: string): string {
  return mensaje.replace(/^[A-Z][A-Z0-9_]*:\s*/, '').trim() || mensaje;
}

async function autenticar(
  ruta: '/auth/register' | '/auth/login',
  email: string,
  contrasena: string,
): Promise<UsuarioOmniTravel> {
  let respuesta: RespuestaSesion;
  try {
    respuesta = await apiFetch<RespuestaSesion>(ruta, {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: contrasena,
      }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(mensajeLegible(error.message), error.status);
    }
    throw error;
  }
  const { token, usuario } = respuesta;
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
  return usuario;
}

/** Crea la cuenta (rol viajero) y deja la sesión iniciada. */
export async function registrarCuenta(
  datos: DatosRegistro,
): Promise<ResultadoRegistro> {
  const perfil = await autenticar(
    '/auth/register',
    datos.email,
    datos.contrasena,
  );
  return { email: perfil.email, perfil };
}

/** Inicia sesión y devuelve el perfil de dominio con su rol. */
export async function iniciarSesionCuenta(
  email: string,
  contrasena: string,
): Promise<ResultadoSesion> {
  const perfil = await autenticar('/auth/login', email, contrasena);
  return { perfil };
}

/** Borra el token del dispositivo (el JWT expira solo en ≤ 24 h). */
export async function cerrarSesionCuenta(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_TOKEN).catch(() => undefined);
}

/** M07 «Cambiar contraseña»: exige la actual; el backend aplica la política. */
export async function cambiarContrasena(
  actual: string,
  nueva: string,
): Promise<void> {
  try {
    await apiFetch('/auth/cambiar-contrasena', {
      method: 'POST',
      body: JSON.stringify({ actual, nueva }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(mensajeLegible(error.message), error.status);
    }
    throw error;
  }
}
