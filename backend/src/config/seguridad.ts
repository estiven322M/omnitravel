import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Ajustes de seguridad leídos del entorno, en un solo lugar y fáciles de probar.
 * Los valores por defecto mantienen el comportamiento de desarrollo actual.
 */

/** Orígenes web de Expo en desarrollo (`npx expo start --web`). */
export const ORIGENES_DESARROLLO = [
  'http://localhost:8081',
  'http://localhost:19006',
];

/**
 * Orígenes permitidos por CORS. La app nativa no envía `Origin`, así que CORS
 * solo afecta a clientes web: sin CORS_ORIGINS se permiten los de Expo web.
 */
export function origenesCors(valor: string | undefined): string[] {
  const lista = (valor ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : ORIGENES_DESARROLLO;
}

const SECRETOS_DE_EJEMPLO = new Set(['cambia_esto', 'changeme', 'secret']);
const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Verifica JWT_SECRET al arrancar. En producción un secreto corto o de ejemplo
 * permitiría falsificar sesiones (y roles), así que se rechaza; en desarrollo
 * solo se advierte para no romper los entornos locales del equipo.
 */
export function revisarSecretoJwt(
  secreto: string | undefined,
  entorno: string | undefined,
): { error?: string; advertencia?: string } {
  if (!secreto) {
    return { error: 'Falta JWT_SECRET en backend/.env (ver .env.example).' };
  }
  const debil =
    SECRETOS_DE_EJEMPLO.has(secreto) ||
    secreto.length < LONGITUD_MINIMA_SECRETO;
  if (!debil) {
    return {};
  }
  const mensaje = `JWT_SECRET es débil: usa al menos ${LONGITUD_MINIMA_SECRETO} caracteres aleatorios (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))").`;
  return entorno === 'production'
    ? { error: mensaje }
    : { advertencia: mensaje };
}

/**
 * TLS hacia PostgreSQL. Con DB_SSL_CA (certificado de la CA de AWS RDS) se
 * verifica la identidad del servidor; sin él la conexión va cifrada pero sin
 * verificar, que es el comportamiento que el equipo usa hoy.
 *
 * DB_SSL_CA admite el certificado pegado (con \n escapados) o la ruta a un
 * archivo .pem (forma que usaba la rama main, p. ej. `certs/global-bundle.pem`).
 */
export function opcionesSsl(
  dbSsl: string | undefined,
  ca: string | undefined,
  leerArchivo: (ruta: string) => string = (ruta) =>
    readFileSync(resolve(process.cwd(), ruta), 'utf8'),
): false | { ca?: string; rejectUnauthorized: boolean } {
  if (dbSsl?.toLowerCase() !== 'true') {
    return false;
  }
  if (!ca) {
    return { rejectUnauthorized: false };
  }
  const certificado = ca.includes('BEGIN CERTIFICATE')
    ? ca.replace(/\\n/g, '\n')
    : leerArchivo(ca);
  return { ca: certificado, rejectUnauthorized: true };
}

/** Parámetros TLS que `pg` lee de la URL y que REEMPLAZAN la opción `ssl`. */
const PARAMETROS_SSL_URL = [
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'uselibpqcompat',
];

/**
 * Quita de `DATABASE_URL` los parámetros TLS (`?sslmode=require`…).
 *
 * `pg` da prioridad a la URL sobre la opción `ssl`: con `sslmode` en la URL se
 * descarta la CA de `DB_SSL_CA` y la conexión falla con «self-signed
 * certificate in certificate chain». El TLS lo gobiernan `DB_SSL` y
 * `DB_SSL_CA`, así que la URL no debe repetirlo.
 */
export function urlSinParametrosSsl(url: string | undefined): string | undefined {
  if (!url) {
    return url;
  }
  try {
    const parseada = new URL(url);
    PARAMETROS_SSL_URL.forEach((nombre) => parseada.searchParams.delete(nombre));
    return parseada.toString();
  } catch {
    return url;
  }
}

/** La telemetría externa solo se activa si el equipo define sus credenciales. */
export function telemetriaActiva(entorno: NodeJS.ProcessEnv): boolean {
  return Boolean(entorno.OBSERVE_APP_KEY && entorno.OBSERVE_APP_SECRET);
}
