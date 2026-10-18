/**
 * Tipos del esquema Supabase del proyecto OmniTravel.
 *
 * Reflejan las columnas de la tabla `usuarios` (ver front web del equipo).
 * Se usan en el servicio de autenticación/pasajeros sin perder el tipado
 * estricto del front.
 */

export type RolUsuario = 'estudiante' | 'pasajero' | 'admin' | 'superadmin';

export type EstadoAprobacion = 'pendiente' | 'aprobado' | 'rechazado';

export type EstadoViajeUsuario =
  'ninguno' | 'asignado' | 'asistencia_cancelada';

/** Fila de la tabla `usuarios`. */
export interface UsuarioSupabase {
  id: string;
  rol: RolUsuario;
  nombre_completo: string | null;
  telefono: string | null;
  dni: string | null;
  es_menor: boolean;
  fecha_nacimiento: string | null;
  codigo_pasajero: string | null;
  email: string | null;
  password: string | null;
  foto_perfil: string | null;
  face_descriptor: unknown | null;
  departamento: string | null;
  municipio: string | null;
  direccion: string | null;
  estado_aprobacion: EstadoAprobacion | null;
  viaje_id: string | null;
  creado_en: string;
  parada_id: string | null;
  asiento: string | null;
  transporte_id: string | null;
  estado_viaje: EstadoViajeUsuario | null;
  fecha_reserva: string | null;
  abordo: boolean | null;
  asistencia_cancelada: boolean | null;
}

/** Datos mínimos para registrar un pasajero desde la app móvil. */
export interface DatosRegistroPasajero {
  nombre: string;
  email: string;
  contrasena: string;
  necesidades: string[];
  /** Se rellenan con valores por defecto si no se proporcionan. */
  telefono?: string;
  departamento?: string;
  municipio?: string;
}

export interface ResultadoLogin {
  usuario: UsuarioSupabase;
}
