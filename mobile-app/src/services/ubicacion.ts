import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { Coordenada } from './types';

/**
 * Ubicación actual del dispositivo con mensajes claros por plataforma.
 *
 * - Teléfono: permiso de expo-location y GPS (si el GPS tarda, se usa la
 *   última posición conocida).
 * - Web: la API del navegador directamente. `expo-location` en web consulta
 *   el estado del permiso antes de pedirlo y en algunos navegadores lo
 *   reporta como denegado sin mostrar la ventana; pedir la posición sí la
 *   muestra.
 */
export type MotivoUbicacion = 'permiso' | 'no-disponible';

export class UbicacionError extends Error {
  constructor(readonly motivo: MotivoUbicacion) {
    super(mensajeDeUbicacion(motivo));
    this.name = 'UbicacionError';
  }
}

export function mensajeDeUbicacion(
  motivo: MotivoUbicacion,
  plataforma: string = Platform.OS,
): string {
  if (motivo === 'permiso') {
    return plataforma === 'web'
      ? 'El navegador bloqueó la ubicación. Pulsa el candado junto a la dirección de la página, permite «Ubicación» y vuelve a intentarlo, o escríbela abajo.'
      : 'Sin permiso de ubicación. Actívalo en Ajustes → Aplicaciones → OmniTravel → Permisos, o escríbela abajo.';
  }
  return plataforma === 'web'
    ? 'No pudimos obtener tu ubicación desde el navegador. Inténtalo de nuevo o escríbela abajo.'
    : 'No pudimos obtener tu ubicación. Activa el GPS del teléfono e inténtalo de nuevo, o escríbela abajo.';
}

function desdeNavegador(): Promise<Coordenada> {
  return new Promise((resolver, rechazar) => {
    const geo =
      typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      rechazar(new UbicacionError('no-disponible'));
      return;
    }
    geo.getCurrentPosition(
      (posicion) =>
        resolver({
          latitude: posicion.coords.latitude,
          longitude: posicion.coords.longitude,
        }),
      (error) =>
        rechazar(
          new UbicacionError(error.code === 1 ? 'permiso' : 'no-disponible'),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

async function desdeTelefono(): Promise<Coordenada> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new UbicacionError('permiso');
  }
  try {
    // RNF-18: el origen de la ruta y la ubicación de un reporte necesitan
    // precisión de GPS (< 10 m). «Balanced» usa wifi y antenas (≈ 100 m):
    // en la medición del 11/11/2026 el error fue de 41 a 104 m.
    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    return {
      latitude: posicion.coords.latitude,
      longitude: posicion.coords.longitude,
    };
  } catch {
    const ultima = await Location.getLastKnownPositionAsync();
    if (ultima) {
      return {
        latitude: ultima.coords.latitude,
        longitude: ultima.coords.longitude,
      };
    }
    throw new UbicacionError('no-disponible');
  }
}

export function obtenerUbicacionActual(): Promise<Coordenada> {
  return Platform.OS === 'web' ? desdeNavegador() : desdeTelefono();
}
