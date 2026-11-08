#!/usr/bin/env node
/**
 * Muestra columnas, valores por defecto y restricciones CHECK de las tablas
 * del Proceso 3 (o de las que se pasen como argumento) en la base de datos
 * de DATABASE_URL. Sirve para comprobar que el backend escribe con los
 * nombres y valores reales del esquema de AWS RDS.
 *
 *   npm run ver-esquema
 *   npm run ver-esquema -- reporte confirmacion
 *
 * Solo lee: abre la sesión en modo de solo lectura.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const TABLAS_POR_DEFECTO = ['retroalimentacion', 'incidencia', 'solicitud_reverificacion'];

function salir(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

function urlSinParametrosSsl(url) {
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
    return { rejectUnauthorized: true };
  }
  return {
    ca: ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : readFileSync(ca, 'utf8'),
    rejectUnauthorized: true,
  };
}

async function main() {
  const tablas = process.argv.slice(2).length ? process.argv.slice(2) : TABLAS_POR_DEFECTO;
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
    for (const tabla of tablas) {
      const { rows: columnas } = await cliente.query(
        `select column_name as columna, data_type as tipo, is_nullable as nulo,
                column_default as por_defecto
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [tabla],
      );
      const { rows: restricciones } = await cliente.query(
        `select conname as nombre, pg_get_constraintdef(c.oid) as definicion
           from pg_constraint c
           join pg_class t on t.oid = c.conrelid
           join pg_namespace n on n.oid = t.relnamespace
          where n.nspname = 'public' and t.relname = $1
          order by contype, conname`,
        [tabla],
      );
      const { rows: [{ filas }] } = columnas.length
        ? await cliente.query(`select count(*)::int as filas from public."${tabla}"`)
        : { rows: [{ filas: 0 }] };
      console.log(`\n=== ${tabla} (${columnas.length ? `${filas} filas` : 'NO EXISTE'})`);
      if (columnas.length) {
        console.table(columnas);
        console.table(restricciones);
      }
    }
  } finally {
    await cliente.end();
  }
}

main().catch((error) => salir(error.message));
