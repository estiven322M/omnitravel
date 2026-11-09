#!/usr/bin/env node
/**
 * Migraciones versionadas (auditoría NC-04).
 *
 * Aplica en orden los archivos `sql/NNN-*.sql` que aún no estén registrados
 * en la tabla `migracion_aplicada` (versión, archivo, huella SHA-256 y fecha).
 * Cada archivo trae su propio begin/commit; si uno falla, se detiene ahí y la
 * base queda como estaba antes de ese archivo.
 *
 *   npm run migrar                       # muestra las pendientes (no cambia nada)
 *   npm run migrar -- --aplicar          # aplica las pendientes
 *   npm run migrar -- --linea-base=003   # base existente: marca 000–003 como aplicadas
 *
 * En la base de producción (creada antes de este comando) se ejecuta UNA vez
 * `--linea-base=003`, porque 000–003 ya están aplicadas; desde ahí basta
 * `--aplicar`. En una base vacía, `--aplicar` crea todo desde 000.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { conectar } from './conexion.mjs';

const CARPETA = new URL('../sql/', import.meta.url);
const aplicar = process.argv.includes('--aplicar');
const lineaBase = process.argv.find((a) => a.startsWith('--linea-base='))?.split('=')[1];

const archivos = readdirSync(CARPETA)
  .filter((nombre) => /^\d{3}-.+\.sql$/.test(nombre))
  .sort()
  .map((nombre) => {
    const contenido = readFileSync(new URL(nombre, CARPETA), 'utf8');
    return {
      version: nombre.slice(0, 3),
      nombre,
      contenido,
      huella: createHash('sha256').update(contenido).digest('hex'),
    };
  });

const cliente = await conectar();
try {
  await cliente.query(`create table if not exists public.migracion_aplicada (
    version text primary key,
    archivo text not null,
    huella text not null,
    fecha timestamptz not null default now()
  )`);

  if (lineaBase) {
    const base = archivos.filter((a) => a.version <= lineaBase);
    for (const a of base) {
      await cliente.query(
        `insert into public.migracion_aplicada (version, archivo, huella)
         values ($1, $2, $3) on conflict (version) do nothing`,
        [a.version, a.nombre, a.huella],
      );
    }
    console.log(`✔ Línea base registrada: ${base.map((a) => a.nombre).join(', ')}`);
  }

  const { rows } = await cliente.query('select version, huella from public.migracion_aplicada');
  const aplicadas = new Map(rows.map((f) => [f.version, f.huella]));

  for (const a of archivos) {
    const huella = aplicadas.get(a.version);
    if (huella && huella !== a.huella) {
      console.warn(`  ⚠ ${a.nombre} cambió después de aplicarse (las migraciones no se editan; crea una nueva).`);
    }
  }

  const pendientes = archivos.filter((a) => !aplicadas.has(a.version));
  if (pendientes.length === 0) {
    console.log('✔ La base está al día: no hay migraciones pendientes.');
  } else if (!aplicar) {
    console.log('Migraciones pendientes:');
    pendientes.forEach((a) => console.log(`  • ${a.nombre}`));
    console.log('\nPara aplicarlas: npm run migrar -- --aplicar');
  } else {
    for (const a of pendientes) {
      try {
        await cliente.query(a.contenido);
      } catch (error) {
        await cliente.query('rollback').catch(() => {});
        throw new Error(`${a.nombre}: ${error.message}`);
      }
      await cliente.query(
        'insert into public.migracion_aplicada (version, archivo, huella) values ($1, $2, $3)',
        [a.version, a.nombre, a.huella],
      );
      console.log(`✔ Aplicada ${a.nombre}`);
    }
  }
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
