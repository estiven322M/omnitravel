import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Enlaces firmados para las fotos de evidencia (auditoría 6.7 ítem 5, riesgo 5).
 *
 * Las fotos solo se muestran en la consola de moderación, pero `<Image>` no
 * puede enviar el JWT en la cabecera. Por eso el backend, al entregar un
 * reporte a un moderador autenticado, agrega a cada foto un permiso temporal
 * `exp=<segundos>&firma=<HMAC>` y `GET /evidencias/archivo/...` lo verifica.
 * Sin firma válida (o vencida) la foto no se entrega.
 *
 * La vigencia termina en el siguiente cambio de hora + 1 h, así que la URL de
 * una misma foto no cambia en cada consulta y la caché de imágenes funciona.
 */
export const VIGENCIA_SEGUNDOS = 3600;

function clave(secreto: string): Buffer {
  // Clave propia para este uso, derivada del secreto del backend.
  return createHmac('sha256', secreto).update('omnitravel:evidencias').digest();
}

function calcular(storageKey: string, exp: number, secreto: string): string {
  return createHmac('sha256', clave(secreto))
    .update(`${storageKey}:${exp}`)
    .digest('base64url');
}

/** Query string con el permiso temporal de una foto (`exp=…&firma=…`). */
export function firmarEvidencia(
  storageKey: string,
  secreto: string,
  ahoraMs: number = Date.now(),
): string {
  const ahora = Math.floor(ahoraMs / 1000);
  const exp = (Math.floor(ahora / VIGENCIA_SEGUNDOS) + 2) * VIGENCIA_SEGUNDOS;
  return `exp=${exp}&firma=${calcular(storageKey, exp, secreto)}`;
}

/** true solo si la firma corresponde a la foto y no ha vencido. */
export function firmaValida(
  storageKey: string,
  exp: unknown,
  firma: unknown,
  secreto: string,
  ahoraMs: number = Date.now(),
): boolean {
  if (
    typeof exp !== 'string' ||
    typeof firma !== 'string' ||
    !/^\d{1,12}$/.test(exp)
  ) {
    return false;
  }
  const vence = Number(exp);
  if (vence * 1000 <= ahoraMs) {
    return false;
  }
  const esperada = Buffer.from(calcular(storageKey, vence, secreto));
  const recibida = Buffer.from(firma);
  return (
    esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
  );
}

/** Secreto del backend (el mismo JWT_SECRET que ya se exige en producción). */
export function secretoEvidencias(): string {
  return process.env.JWT_SECRET ?? '';
}
