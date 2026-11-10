#!/usr/bin/env node
/**
 * Elimina un lugar (POI) REPETIDO o cargado por error, con sus datos de
 * catálogo (valores de accesibilidad, fotos y favoritos), en una transacción.
 *
 * Por seguridad NO borra lugares con visitas, calificaciones o establecimiento
 * asociado. Un lugar de PRUEBA creado con «Contribuir» (lugar nuevo) tiene su
 * reporte: con --con-reportes se borran también sus reportes y lo que cuelga
 * de ellos (confirmaciones, valores propuestos, evidencias, decisiones y
 * denuncias).
 *
 *   npm run eliminar-lugar -- --id=125                              # simulación
 *   npm run eliminar-lugar -- --id=125 --confirmar                  # elimina
 *   npm run eliminar-lugar -- --id=140 --con-reportes --confirmar   # lugar de prueba con reporte
 */
import { conectar } from './conexion.mjs';

const id = Number(process.argv.find((a) => a.startsWith('--id='))?.split('=')[1]);
const confirmar = process.argv.includes('--confirmar');
const conReportes = process.argv.includes('--con-reportes');
if (!Number.isInteger(id) || id <= 0) {
  console.error('✖ Indica el lugar: npm run eliminar-lugar -- --id=125');
  process.exit(1);
}

const ACTIVIDAD = ['visita', 'retroalimentacion', 'establecimiento_turistico', ...(conReportes ? [] : ['reporte'])];
/** Lo que cuelga de un reporte, en orden de borrado. */
const DE_REPORTE = ['confirmacion', 'valor_caracteristica_reporte', 'evidencia', 'moderacion', 'denuncia'];
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
      throw new Error(`Tiene ${n} fila(s) en «${tabla}»: no se elimina un lugar con actividad de la comunidad.${tabla === 'reporte' ? ' Si es un lugar de prueba, agrega --con-reportes.' : ''}`);
    }
  }

  await cliente.query('begin');
  if (conReportes) {
    await cliente.query(
      `update solicitud_reverificacion set reporte_generado_id = null
        where reporte_generado_id in (select id_reporte from reporte where poi_id = $1)`,
      [id],
    );
    for (const tabla of DE_REPORTE) {
      const { rowCount } = await cliente.query(
        `delete from ${tabla} where reporte_id in (select id_reporte from reporte where poi_id = $1)`,
        [id],
      );
      console.log(`  • ${tabla}: ${rowCount} fila(s)`);
    }
    const { rowCount } = await cliente.query('delete from reporte where poi_id = $1', [id]);
    console.log(`  • reporte: ${rowCount} fila(s)`);
  }
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
