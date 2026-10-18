import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './client';

/**
 * Servicio de autenticación: consume `POST /auth/register` y
 * `POST /auth/login` del backend (NestJS → PostgreSQL en AWS).
 *
 * El token de sesión (JWT) se guarda cifrado en el dispositivo con
 * expo-secure-store (RNF-07/RNF-08). Solo se envían email y contraseña:
 * el perfil de accesibilidad nunca sale del teléfono (Ley 1581).
 */

const CLAVE_TOKEN = 'omnitravel-token';

export interface UsuarioSesion {
  id: string;
  email: string;
  rol: string;
}

interface RespuestaSesion {
  token: string;
  usuario: UsuarioSesion;
}

async function autenticar(
  ruta: '/auth/register' | '/auth/login',
  email: string,
  contrasena: string,
): Promise<UsuarioSesion> {
  const { token, usuario } = await apiFetch<RespuestaSesion>(ruta, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password: contrasena }),
  });
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
  return usuario;
}

export function registrarUsuario(email: string, contrasena: string) {
  return autenticar('/auth/register', email, contrasena);
}

export function iniciarSesion(email: string, contrasena: string) {
  return autenticar('/auth/login', email, contrasena);
}

export function obtenerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}

export function borrarToken(): Promise<void> {
  return SecureStore.deleteItemAsync(CLAVE_TOKEN);
}
