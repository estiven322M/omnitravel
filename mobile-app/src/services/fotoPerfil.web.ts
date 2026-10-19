import * as ImagePicker from 'expo-image-picker';

/**
 * Versión web de la foto de perfil (`fotoPerfil.ts`).
 *
 * En el navegador no hay sistema de archivos de la app: la imagen elegida se
 * reduce a 256×256 y se guarda como data URI en el almacenamiento de ESTE
 * navegador, una por cuenta. Igual que en el teléfono, nunca se sube a un
 * servidor.
 */

const LADO = 256;

export class FotoPerfilError extends Error {}

/** Nombre seguro de la foto para una cuenta (`perfil-foto-<id>.jpg`). */
export function nombreFotoDePerfil(idCuenta: string): string {
  const seguro = idCuenta.replace(/[^a-zA-Z0-9_-]/g, '');
  return `perfil-foto-${seguro || 'anonimo'}.jpg`;
}

const claveDe = (idCuenta: string) =>
  `omnitravel-${nombreFotoDePerfil(idCuenta)}`;

function almacen(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Foto guardada de la cuenta en este navegador, o `null`. */
export function uriFotoDePerfilGuardada(idCuenta: string): string | null {
  try {
    return almacen()?.getItem(claveDe(idCuenta)) ?? null;
  } catch {
    return null;
  }
}

/** Recorta al centro y reduce la imagen a un cuadrado JPEG de 256 px. */
function reducir(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const imagen = new window.Image();
    imagen.onload = () => {
      const lado = Math.min(imagen.width, imagen.height);
      const lienzo = document.createElement('canvas');
      lienzo.width = LADO;
      lienzo.height = LADO;
      const contexto = lienzo.getContext('2d');
      if (!contexto || lado === 0) {
        reject(new Error('sin lienzo'));
        return;
      }
      contexto.drawImage(
        imagen,
        (imagen.width - lado) / 2,
        (imagen.height - lado) / 2,
        lado,
        lado,
        0,
        0,
        LADO,
        LADO,
      );
      resolve(lienzo.toDataURL('image/jpeg', 0.85));
    };
    imagen.onerror = () => reject(new Error('imagen ilegible'));
    imagen.src = uri;
  });
}

/** Abre el selector de archivos y devuelve la foto (data URI) o `null`. */
export async function elegirFotoDePerfil(
  idCuenta: string,
): Promise<string | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  let foto: string;
  try {
    foto = await reducir(resultado.assets[0].uri);
  } catch {
    throw new FotoPerfilError(
      'No pudimos leer esa imagen. Prueba con una foto JPG o PNG.',
    );
  }

  try {
    almacen()?.setItem(claveDe(idCuenta), foto);
  } catch {
    throw new FotoPerfilError(
      'El navegador no permitió guardar la foto. Revisa que no estés en modo privado.',
    );
  }
  return foto;
}

/** Quita la foto de la cuenta en este navegador. */
export function borrarFotoDePerfil(idCuenta: string): void {
  try {
    almacen()?.removeItem(claveDe(idCuenta));
  } catch {
    // Nada que borrar.
  }
}
