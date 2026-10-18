export { supabase, SUPABASE_URL } from './client';
export {
  registrarPasajeroSupabase,
  iniciarSesionPasajero,
  obtenerUsuarioPorId,
} from './auth';
export type {
  UsuarioSupabase,
  RolUsuario,
  EstadoAprobacion,
  DatosRegistroPasajero,
  ResultadoLogin,
} from './types';
export { hashearContrasena } from './hash';
