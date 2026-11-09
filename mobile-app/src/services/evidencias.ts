import * as ImagePicker from 'expo-image-picker';
import { API_URL, apiFetch } from './api/client';

/**
 * Evidencia fotográfica del Proceso 1 (U09).
 *
 * Flujo: image-picker captura con `base64: true` (compatible con Expo Go y
 * con el APK de EAS) → se envía a `POST /evidencias` del backend, que valida
 * peso (5 MB) y tipo de imagen (RNF-28) y la guarda en la carpeta del
 * usuario autenticado (`<id_usuario>/…`). Por ahora el backend la guarda en
 * su disco; al desplegar en AWS pasará a un bucket S3 sin cambiar este
 * contrato. Si la subida falla, el reporte se envía igual sin foto.
 */

/** Las fotos pesan hasta 5 MB: se da más margen que el timeout por defecto. */
const TIMEOUT_SUBIDA_MS = 60000;

/** Foto capturada y lista para subir. */
export interface FotoCapturada {
  uri: string;
  base64: string;
  mimeType: string;
}

export type OrigenFoto = 'camara' | 'galeria';

const ERROR_PERMISO_CAMARA =
  'Necesitamos permiso de cámara para tomar la foto de evidencia.';
const ERROR_PERMISO_GALERIA = 'Necesitamos permiso para acceder a tus fotos.';
const ERROR_LECTURA =
  'No pudimos leer la imagen seleccionada. Intenta con otra.';

/**
 * Abre la cámara o la galería y devuelve la foto comprimida en base64.
 * `null` cuando la persona cancela la captura.
 */
export async function capturarFoto(
  origen: OrigenFoto,
): Promise<FotoCapturada | null> {
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      throw new Error(ERROR_PERMISO_CAMARA);
    }
  } else {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      throw new Error(ERROR_PERMISO_GALERIA);
    }
  }

  const resultado =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.4,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.4,
          base64: true,
        });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  const activo = resultado.assets[0];
  if (!activo.base64) {
    throw new Error(ERROR_LECTURA);
  }

  return {
    uri: activo.uri,
    base64: activo.base64,
    mimeType: activo.mimeType ?? 'image/jpeg',
  };
}

/**
 * Sube la foto al backend y devuelve la ruta (`storage_key`) que se
 * persiste en la tabla `evidencia` al crear el reporte.
 */
export async function subirEvidencia(
  foto: FotoCapturada,
): Promise<{ storageKey: string }> {
  try {
    return await apiFetch<{ storageKey: string }>(
      '/evidencias',
      {
        method: 'POST',
        body: JSON.stringify({ base64: foto.base64, mimeType: foto.mimeType }),
      },
      TIMEOUT_SUBIDA_MS,
    );
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    if (mensaje.startsWith('USUARIO_NO_VINCULADO')) {
      throw new Error(
        'Necesitas una sesión activa para adjuntar la foto de evidencia.',
      );
    }
    throw new Error(
      'No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.',
    );
  }
}

/**
 * URL de lectura de una evidencia. El backend solo entrega la foto con el
 * permiso temporal (`exp=…&firma=…`) que agrega a los reportes que ve un
 * moderador; sin él responde 403.
 */
export function urlPublicaEvidencia(
  storageKey: string,
  acceso?: string | null,
): string {
  const base = `${API_URL}/evidencias/archivo/${storageKey}`;
  return acceso ? `${base}?${acceso}` : base;
}
