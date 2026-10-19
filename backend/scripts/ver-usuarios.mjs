#!/usr/bin/env node
/**
 * Muestra las cuentas guardadas en la base de datos que usa el backend
 * (la de DATABASE_URL en backend/.env), de la más reciente a la más antigua.
 * Sirve para comprobar que los registros de la app quedan persistidos.
 *
 *   npm run ver-usuarios            # últimas 20
 *   npm run ver-usuarios -- 50      # últimas 50
 *
 * Solo lee: no muestra contraseñas ni modifica nada.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

function salir(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

/**
 * `pg` da prioridad a `?sslmode=…` de la URL sobre la opción `ssl` (y descarta
 * la CA). El TLS lo gobiernan DB_SSL / DB_SSL_CA, igual que en el backend.
 */
export function urlSinParametrosSsl(url) {
  try {
    const parseada = new URL(url);
    ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'].forEach(
      (nombre) => parseada.searchParams.delete(nombre),
    );
    return parseada.toString();
  } catch {
    return url;
  }
}

function opcionesSsl() {
  if (process.env.DB_SSL !== 'true') {
    return false;
  }
  const ca = process.env.DB_SSL_CA?.trim();
  if (!ca) {
    // Sin CA, Node no reconoce la autoridad de RDS: se pide configurarla.
    return { rejectUnauthorized: true };
  }
  return {
    ca: ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : readFileSync(ca, 'utf8'),
    rejectUnauthorized: true,
  };
}

async function main() {
  const limite = Math.min(Math.max(Number.parseInt(process.argv[2] ?? '20', 10) || 20, 1), 500);
  if (!process.env.DATABASE_URL) {
    salir('Falta DATABASE_URL (revisa backend/.env).');
  }
  const cliente = new pg.Client({
    connectionString: urlSinParametrosSsl(process.env.DATABASE_URL),
    ssl: opcionesSsl(),
  });
  await cliente.connect();
  try {
    await cliente.query('set default_transaction_read_only = on');
    const { rows: [{ total }] } = await cliente.query('select count(*)::int as total from usuario');
    const { rows } = await cliente.query(
      `select u.id_usuario::int as id, u.email, r.nombre_rol as rol, u.estado_cuenta as estado,
              to_char(u.fecha_registro at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as registro
         from usuario u left join rol r on r.id_rol = u.rol_id
        order by u.fecha_registro desc nulls last, u.id_usuario desc
        limit $1`,
      [limite],
    );
    const base = new URL(process.env.DATABASE_URL);
    console.log(`Base de datos: ${base.hostname}${base.pathname} — ${total} cuentas en total\n`);
    console.table(rows);
  } finally {
    await cliente.end();
  }
}

main().catch((error) => salir(error.message));
