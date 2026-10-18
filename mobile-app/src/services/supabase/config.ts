/**
 * Configuración del cliente Supabase.
 *
 * Por defecto se usan las credenciales del proyecto compartido por el equipo
 * (misma URL y anon key que el front web, ver `FacultadCienciaYTecnologia/OmniTravel`).
 * Se pueden sobreescribir con variables de entorno Expo:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://kwseysanvdyvtfofnhzw.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3c2V5c2FudmR5dnRmb2ZuaHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDExMzEsImV4cCI6MjEwNDk3NzEzMX0.jEQ5MUak6efMOOFTF7utYqkOiVko0w1JWj0ZOUldOTg';
