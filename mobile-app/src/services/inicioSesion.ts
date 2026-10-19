import { useProfileStore } from '../store/profileStore';
import type { RolUsuario } from './types';
import {
  cerrarSesionCuenta,
  iniciarSesionCuenta,
  rolDeUsuarioId,
} from './api/auth';
import { uriFotoDePerfilGuardada } from './fotoPerfil';

export const ROLES_MODERACION: readonly RolUsuario[] = [
  'moderador',
  'administrador',
];

export function esRolModeracion(rol?: RolUsuario | null): boolean {
  return rol != null && ROLES_MODERACION.includes(rol);
}

/** Nombre amable derivado del correo (la BD no guarda nombre de persona). */
export function nombreDesdeEmail(email: string): string {
  const usuario = email.split('@')[0]?.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+/g, ' ');
  const limpio = usuario?.trim();
  if (!limpio) {
    return 'Viajero OmniTravel';
  }
  return limpio
    .split(' ')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

export class SinPermisoModeracionError extends Error {
  constructor() {
    super(
      'Esta cuenta no tiene permisos de moderación. Entra desde el inicio de sesión de viajeros.',
    );
    this.name = 'SinPermisoModeracionError';
  }
}

/**
 * Inicio de sesión completo (U02 y M01): autentica contra el backend, guarda
 * el perfil local con el rol REAL de la BD y recupera la foto de esa cuenta.
 *
 * Con `soloModeracion` (M01) una cuenta sin rol de moderación no entra: se
 * borra el token recién emitido y se informa con claridad.
 */
export async function iniciarSesionCompleta(
  email: string,
  contrasena: string,
  opciones: { soloModeracion?: boolean } = {},
): Promise<{ rol: RolUsuario; aviso?: string }> {
  const correo = email.trim();
  const resultado = await iniciarSesionCuenta(correo, contrasena);
  const rol = rolDeUsuarioId(resultado.perfil?.rol_id);

  if (opciones.soloModeracion && !esRolModeracion(rol)) {
    await cerrarSesionCuenta();
    throw new SinPermisoModeracionError();
  }

  const idCuenta =
    resultado.perfil?.id_usuario != null
      ? String(resultado.perfil.id_usuario)
      : undefined;
  const estado = useProfileStore.getState();

  // El perfil de accesibilidad sigue siendo 100 % local (Ley 1581).
  estado.guardarPerfil({
    nombre: nombreDesdeEmail(resultado.perfil?.email ?? correo),
    necesidades: [],
    filtrosActivos: [],
    rol,
    idCuenta,
  });

  // Cada cuenta tiene SU foto en el dispositivo (nunca se comparte).
  if (idCuenta) {
    const uriGuardada = uriFotoDePerfilGuardada(idCuenta);
    if (uriGuardada) {
      estado.establecerFoto(uriGuardada);
    }
  }
  estado.recordarEmail(correo);

  return { rol, aviso: resultado.aviso };
}
