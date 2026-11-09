#!/usr/bin/env node
/**
 * Genera el modelo entidad-relación (MER) en Mermaid a partir del catálogo de
 * la base: tablas, columnas con su tipo, llaves primarias (PK), foráneas (FK)
 * y únicas (UK), y cada relación con su cardinalidad. Así el diagrama nunca se
 * desactualiza frente al código (auditoría NC-04).
 *
 *   npm run generar-mer      # escribe ../docs/modelo-datos/mer.mmd
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { conectar } from './conexion.mjs';

const SALIDA = new URL('../../docs/modelo-datos/', import.meta.url);
const tipoCorto = (t) =>
  t.replace('timestamp with time zone', 'timestamptz')
    .replace(/geometry\(Point,4326\)/, 'geometry_point')
    .replace(/\s+/g, '_');

const cliente = await conectar();
try {
  const { rows: columnas } = await cliente.query(`
    select c.table_name as tabla, c.column_name as columna, c.ordinal_position as orden,
           case when c.data_type = 'USER-DEFINED' then format_type(a.atttypid, a.atttypmod) else c.data_type end as tipo,
           c.is_nullable = 'NO' as obligatoria
      from information_schema.columns c
      join pg_class t on t.relname = c.table_name
      join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = t.oid and a.attname = c.column_name
     where c.table_schema = 'public' and t.relkind = 'r'
       and c.table_name not in ('spatial_ref_sys', 'migracion_aplicada')
     order by c.table_name, c.ordinal_position`);

  const { rows: llaves } = await cliente.query(`
    select con.conrelid::regclass::text as tabla, con.contype as tipo,
           array_agg(a.attname::text order by k.ord) as columnas,
           con.confrelid::regclass::text as referida
      from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace and n.nspname = 'public'
      cross join lateral unnest(con.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
     where con.contype in ('p', 'f', 'u')
     group by con.oid, con.conrelid, con.contype, con.confrelid`);

  // Índices únicos (p. ej. una calificación por visita) también son UK. Los
  // parciales solo cuentan si excluyen nulos (`where col is not null`).
  const { rows: unicos } = await cliente.query(`
    select t.relname as tabla, array_agg(a.attname::text) as columnas
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
     where i.indisunique and not i.indisprimary
       and (i.indpred is null or pg_get_expr(i.indpred, i.indrelid) ilike '%is not null%')
     group by i.indexrelid, t.relname`);

  // ¿La columna sola es única? (PK o UK de una sola columna; las compuestas
  // como (reporte_id, usuario_id) no hacen única a cada columna por separado).
  const unicaSola = (tabla, columna) =>
    llaves.some((l) => l.tabla === tabla && ['p', 'u'].includes(l.tipo) && l.columnas.length === 1 && l.columnas[0] === columna) ||
    unicos.some((u) => u.tabla === tabla && u.columnas.length === 1 && u.columnas[0] === columna);
  const marca = (tabla, columna) => {
    const m = [];
    if (llaves.some((l) => l.tabla === tabla && l.tipo === 'p' && l.columnas.includes(columna))) m.push('PK');
    if (llaves.some((l) => l.tabla === tabla && l.tipo === 'f' && l.columnas.includes(columna))) m.push('FK');
    if (!m.includes('PK') && unicaSola(tabla, columna)) m.push('UK');
    return m.length ? ` ${m.join(', ')}` : '';
  };

  const tablas = [...new Set(columnas.map((c) => c.tabla))];
  const lineas = ['erDiagram'];
  for (const tabla of tablas) {
    lineas.push(`  ${tabla} {`);
    for (const c of columnas.filter((x) => x.tabla === tabla)) {
      lineas.push(`    ${tipoCorto(c.tipo)} ${c.columna}${marca(tabla, c.columna)}${c.obligatoria ? '' : ' "opcional"'}`);
    }
    lineas.push('  }');
  }

  // Relaciones: la FK obligatoria es «exactamente uno» del lado referido; si
  // la FK es además única, la relación es 1 a 0..1.
  for (const fk of llaves.filter((l) => l.tipo === 'f')) {
    const obligatoria = fk.columnas.every(
      (col) => columnas.find((c) => c.tabla === fk.tabla && c.columna === col)?.obligatoria,
    );
    const unica = fk.columnas.length === 1 && unicaSola(fk.tabla, fk.columnas[0]);
    const lado = obligatoria ? '||' : 'o|';
    const muchos = unica ? 'o|' : 'o{';
    lineas.push(`  ${fk.referida} ${lado}--${muchos} ${fk.tabla} : "${fk.columnas.join(', ')}"`);
  }

  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(new URL('mer.mmd', SALIDA), `${lineas.join('\n')}\n`);
  console.log(`✔ MER generado: ${tablas.length} tablas, ${llaves.filter((l) => l.tipo === 'f').length} relaciones → docs/modelo-datos/mer.mmd`);
} finally {
  await cliente.end();
}
