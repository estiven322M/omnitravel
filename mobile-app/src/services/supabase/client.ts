import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Adaptador de almacenamiento para la sesión de Supabase usando
 * expo-secure-store (Keychain/Keystore). Mantiene la sesión cifrada en el
 * dispositivo, alineado con RNF-07/RNF-08 (Privacy by Design).
 */
const almacenamientoSeguro = {
  getItem: (nombre: string) => SecureStore.getItemAsync(nombre),
  setItem: (nombre: string, valor: string) =>
    SecureStore.setItemAsync(nombre, valor),
  removeItem: (nombre: string) => SecureStore.deleteItemAsync(nombre),
};

/**
 * Cliente compartido. Usa la anon key del proyecto; las políticas RLS de
 * Supabase controlan el acceso por tabla. La sesión se persiste cifrada.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: almacenamientoSeguro,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { SUPABASE_URL };
