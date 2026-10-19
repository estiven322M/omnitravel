import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/**
 * Foto de perfil local (U12).
 *
 * Privacidad por diseño (Ley 1581): la imagen elegida se copia al
 * almacenamiento privado de la app y NUNCA se sube a un servidor. Cada
 * CUENTA tiene su propio archivo (`perfil-foto-<idCuenta>.jpg`) para que
 * el avatar correspondiente aparezca al iniciar sesión y no se comparta
 * la foto de una persona con otra cuenta del mismo dispositivo.
 */

/** 4 MB: suficiente para un avatar y lejos del límite de memoria de un JSON. */
const CALIDAD = 0.8;

export class FotoPerfilError extends Error {}

/** Nombre seguro del archivo de foto para una cuenta (`perfil-foto-<id>.jpg`). */
export function nombreFotoDePerfil(idCuenta: string): string {
  const seguro = idCuenta.replace(/[^a-zA-Z0-9_-]/g, '');
  return `perfil-foto-${seguro || 'anonimo'}.jpg`;
}

/** URI de la foto guardada de una cuenta, o `null` si nunca subió una. */
export function uriFotoDePerfilGuardada(idCuenta: string): string | null {
  try {
    const archivo = new File(Paths.document, nombreFotoDePerfil(idCuenta));
    return archivo.exists ? archivo.uri : null;
  } catch {
    // Sin sistema de archivos (p. ej. la vista web): avatar por defecto.
    return null;
  }
}

/** Copia la imagen elegida al directorio privado de la cuenta y devuelve su URI. */
function copiarAlAlmacenPrivado(uriTemporal: string, idCuenta: string): string {
  const destino = new File(Paths.document, nombreFotoDePerfil(idCuenta));

  // Reemplazo atómico: se elimina la copia anterior antes de escribir.
  if (destino.exists) {
    destino.delete();
  }

  const origen = new File(uriTemporal);
  origen.copy(destino);
  return destino.uri;
}

/**
 * Abre la galería y devuelve la URI local de la foto de perfil de la cuenta,
 * o `null` cuando la persona cancela la selección.
 */
export async function elegirFotoDePerfil(
  idCuenta: string,
): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    throw new FotoPerfilError(
      'Sin permiso para abrir la galería. Actívalo en los ajustes del teléfono.',
    );
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: CALIDAD,
  });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  try {
    return copiarAlAlmacenPrivado(resultado.assets[0].uri, idCuenta);
  } catch {
    throw new FotoPerfilError(
      'No pudimos guardar la foto en el dispositivo. Inténtalo de nuevo.',
    );
  }
}

/**
 * Elimina la foto guardada de la cuenta (la persona vuelve al avatar por
 * defecto). Las fotos de OTRAS cuentas no se tocan.
 */
export function borrarFotoDePerfil(idCuenta: string): void {
  try {
    const archivo = new File(Paths.document, nombreFotoDePerfil(idCuenta));
    if (archivo.exists) {
      archivo.delete();
    }
  } catch {
    // Sin sistema de archivos: no hay foto que borrar.
  }
}
