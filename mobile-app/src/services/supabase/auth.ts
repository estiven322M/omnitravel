import { supabase } from './client';
import type { DatosRegistroPasajero, UsuarioSupabase } from './types';
import { hashearContrasena } from './hash';

const TABLA_USUARIOS = 'usuarios';

function mensajeErrorSupabase(error: {
  code?: string;
  message?: string;
}): string {
  if (error.code === '23505') {
    return 'El correo electrónico ya está registrado.';
  }
  if (error.code === 'PGRST116') {
    return 'No se encontró el usuario.';
  }
  return error.message ?? 'Error de Supabase.';
}

/**
 * Crea un pasajero en la tabla `usuarios` usando el mismo esquema que el
 * front web del equipo. La contraseña se guarda hasheada con SHA256.
 */
export async function registrarPasajeroSupabase(
  datos: DatosRegistroPasajero,
): Promise<UsuarioSupabase> {
  const hash = await hashearContrasena(datos.contrasena);
  const ahora = Date.now();

  const payload = {
    nombre_completo: datos.nombre.trim(),
    email: datos.email.trim().toLowerCase(),
    password: hash,
    rol: 'pasajero' as const,
    es_menor: false,
    telefono: datos.telefono ?? '00000000',
    dni: `PAS-${ahora}`,
    fecha_nacimiento: '2000-01-01',
    codigo_pasajero: `PAS${ahora}`,
    departamento: datos.departamento ?? 'Quindío',
    municipio: datos.municipio ?? 'Armenia',
    estado_aprobacion: 'pendiente' as const,
  };

  const { data, error } = await supabase
    .from(TABLA_USUARIOS)
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(
      mensajeErrorSupabase(error as { code?: string; message?: string }),
    );
  }
  return data as UsuarioSupabase;
}

/**
 * Inicia sesión comparando la contraseña hasheada contra la fila existente.
 * Devuelve el usuario autenticado.
 */
export async function iniciarSesionPasajero(
  email: string,
  contrasena: string,
): Promise<UsuarioSupabase> {
  const correo = email.trim().toLowerCase();
  const hash = await hashearContrasena(contrasena);

  const { data, error } = await supabase
    .from(TABLA_USUARIOS)
    .select('*')
    .eq('email', correo)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mensajeErrorSupabase(error));
  }
  if (!data) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  if (data.password !== hash) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  return data as UsuarioSupabase;
}

/**
 * Obtiene un perfil por id.
 */
export async function obtenerUsuarioPorId(
  id: string,
): Promise<UsuarioSupabase | null> {
  const { data, error } = await supabase
    .from(TABLA_USUARIOS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(mensajeErrorSupabase(error));
  }
  return (data as UsuarioSupabase | null) ?? null;
}
