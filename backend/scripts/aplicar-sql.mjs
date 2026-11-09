#!/usr/bin/env node
/**
 * Aplica un archivo de migración SQL (backend/sql/NNN-*.sql) a la base de
 * DATABASE_URL. Las migraciones del proyecto son idempotentes y traen su
 * propio begin/commit: si algo falla, la base queda como estaba.
 *
 *   npm run aplicar-sql -- sql/003-lugares-armenia.sql
 */
import { readFileSync } from 'node:fs';
import { conectar } from './conexion.mjs';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: npm run aplicar-sql -- sql/NNN-nombre.sql');
  process.exit(1);
}
const sql = readFileSync(archivo, 'utf8');
const cliente = await conectar();
try {
  await cliente.query(sql);
  console.log(`✔ Aplicada ${archivo}`);
} catch (error) {
  await cliente.query('rollback').catch(() => {});
  console.error(`✖ No se aplicó ${archivo}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
