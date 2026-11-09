#!/usr/bin/env node
/**
 * Lista los lugares (POI) y el catálogo de características de accesibilidad
 * de la base de datos de DATABASE_URL. Solo lee.
 *
 *   npm run ver-lugares
 *   npm run ver-lugares -- --sin-foto   # solo los lugares sin foto
 */
import { conectar } from './conexion.mjs';

const cliente = await conectar();
try {
  await cliente.query('set default_transaction_read_only = on');
  const { rows: lugares } = await cliente.query(
    `select id_poi::int as id, nombre, tipo, estado,
            round(st_y(ubicacion::geometry)::numeric, 5) as lat,
            round(st_x(ubicacion::geometry)::numeric, 5) as lon,
            (select count(*)::int from valor_accesibilidad_poi v where v.poi_id = p.id_poi) as valores,
            (select count(*)::int from poi_foto f where f.poi_id = p.id_poi) as fotos
       from poi p order by id_poi`,
  );
  if (process.argv.includes('--sin-foto')) {
    const sinFoto = lugares.filter((lugar) => lugar.fotos === 0);
    console.log(`\n=== Lugares sin foto (${sinFoto.length})`);
    console.table(sinFoto.map(({ id, nombre, tipo }) => ({ id, nombre, tipo })));
    process.exit(0);
  }
  console.log(`\n=== Lugares (${lugares.length})`);
  console.table(lugares);
  const { rows: caracteristicas } = await cliente.query(
    `select id_caracteristica::int as id, nombre, tipo_valor, activa
       from caracteristica_accesibilidad order by id_caracteristica`,
  );
  console.log('\n=== Características de accesibilidad');
  console.table(caracteristicas);
} finally {
  await cliente.end();
}
