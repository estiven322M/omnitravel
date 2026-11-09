#!/usr/bin/env node
/**
 * Elimina un lugar (POI) REPETIDO o cargado por error, con sus datos de
 * catálogo (valores de accesibilidad, fotos y favoritos), en una transacción.
 *
 * Por seguridad NO borra lugares con actividad de la comunidad (reportes,
 * visitas, calificaciones o establecimiento asociado): esos se corrigen con
 * el Proceso 1, no se borran.
 *
 *   npm run eliminar-lugar -- --id=125              # simulación (no cambia nada)
 *   npm run eliminar-lugar -- --id=125 --confirmar  # elimina
 */
import { conectar } from './conexion.mjs';

const id = Number(process.argv.find((a) => a.startsWith('--id='))?.split('=')[1]);
const confirmar = process.argv.includes('--confirmar');
if (!Number.isInteger(id) || id <= 0) {
  console.error('✖ Indica el lugar: npm run eliminar-lugar -- --id=125');
  process.exit(1);
}

const ACTIVIDAD = ['reporte', 'visita', 'retroalimentacion', 'establecimiento_turistico'];
const CATALOGO = ['valor_accesibilidad_poi', 'poi_foto', 'favorito'];

const cliente = await conectar();
try {
  const { rows: [lugar] } = await cliente.query(
    'select id_poi::int as id, nombre, tipo, estado from poi where id_poi = $1',
    [id],
  );
  if (!lugar) {
    throw new Error(`No existe el lugar ${id}.`);
  }
  console.log(`\nLugar: #${lugar.id} «${lugar.nombre}» (${lugar.tipo}, ${lugar.estado})`);

  const conteo = async (tabla) =>
    (await cliente.query(`select count(*)::int as n from ${tabla} where poi_id = $1`, [id])).rows[0].n;

  for (const tabla of ACTIVIDAD) {
    const n = await conteo(tabla);
    if (n > 0) {
      throw new Error(`Tiene ${n} fila(s) en «${tabla}»: no se elimina un lugar con actividad de la comunidad.`);
    }
  }

  await cliente.query('begin');
  for (const tabla of CATALOGO) {
    const { rowCount } = await cliente.query(`delete from ${tabla} where poi_id = $1`, [id]);
    console.log(`  • ${tabla}: ${rowCount} fila(s)`);
  }
  await cliente.query('delete from poi where id_poi = $1', [id]);
  console.log('  • poi: 1 fila');

  if (confirmar) {
    await cliente.query('commit');
    console.log(`\n✔ Lugar #${id} eliminado.`);
  } else {
    await cliente.query('rollback');
    console.log('\nSimulación: no se guardó nada. Para eliminarlo agrega --confirmar.');
  }
} catch (error) {
  await cliente.query('rollback').catch(() => {});
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
