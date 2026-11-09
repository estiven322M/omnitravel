/** Conexión a la BD de DATABASE_URL con el mismo TLS que el backend (DB_SSL, DB_SSL_CA). */
import { readFileSync } from 'node:fs';
import pg from 'pg';

function urlSinParametrosSsl(url) {
  try {
    const parseada = new URL(url);
    ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'].forEach((n) =>
      parseada.searchParams.delete(n),
    );
    return parseada.toString();
  } catch {
    return url;
  }
}

function opcionesSsl() {
  if (process.env.DB_SSL !== 'true') return false;
  const ca = process.env.DB_SSL_CA?.trim();
  if (!ca) return { rejectUnauthorized: true };
  return {
    ca: ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : readFileSync(ca, 'utf8'),
    rejectUnauthorized: true,
  };
}

export async function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('✖ Falta DATABASE_URL (revisa backend/.env).');
    process.exit(1);
  }
  const cliente = new pg.Client({
    connectionString: urlSinParametrosSsl(process.env.DATABASE_URL),
    ssl: opcionesSsl(),
  });
  await cliente.connect();
  return cliente;
}
