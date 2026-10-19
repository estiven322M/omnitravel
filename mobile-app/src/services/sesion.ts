import * as SecureStore from './almacenamiento';
import { Alert } from 'react-native';
import { useFavoritosStore } from '../store/favoritosStore';
import { useProfileStore } from '../store/profileStore';
import { cerrarSesionCuenta } from './api/auth';
import {
  CLAVE_TOKEN,
  MENSAJE_SESION_VENCIDA,
  tokenVencido,
} from './api/client';

/**
 * Ciclo de vida de la sesión en el dispositivo.
 *
 * El JWT dura ≤ 24 h (RNF-08). Cuando vence, la app no puede quedarse
 * "con sesión" a medias: se borra el token, se vacían los datos de la cuenta
 * y la navegación vuelve sola al login (RootNavigator depende del perfil).
 */

/** Cierra la sesión: token, guardados y perfil de la cuenta. */
export async function cerrarSesionCompleta(): Promise<void> {
  await cerrarSesionCuenta();
  useFavoritosStore.getState().reiniciar();
  useProfileStore.getState().cerrarSesion();
}

let avisando = false;

/**
 * Sesión vencida: cierra la sesión una sola vez aunque varias peticiones
 * fallen a la vez, y explica a la persona qué pasó (RNF-17).
 */
export async function cerrarSesionPorVencimiento(): Promise<void> {
  if (avisando || !useProfileStore.getState().perfil) {
    return;
  }
  avisando = true;
  try {
    await cerrarSesionCompleta();
    Alert.alert('Sesión vencida', MENSAJE_SESION_VENCIDA);
  } finally {
    avisando = false;
  }
}

/**
 * Comprueba la sesión guardada (al abrir la app o volver a ella): un perfil
 * sin token, o con el token caducado, ya no puede hablar con el backend.
 */
export async function verificarSesionGuardada(): Promise<void> {
  if (!useProfileStore.getState().perfil) {
    return;
  }
  const token = await SecureStore.getItemAsync(CLAVE_TOKEN).catch(() => null);
  if (!token || tokenVencido(token)) {
    await cerrarSesionPorVencimiento();
  }
}
