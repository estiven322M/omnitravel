#!/usr/bin/env node
/**
 * Lista las fotos (tabla poi_foto) de un lugar, para revisar enlaces rotos.
 * Solo lee.
 *
 *   npm run ver-fotos -- --id=48
 */
import { conectar } from './conexion.mjs';

const id = Number(process.argv.find((a) => a.startsWith('--id='))?.split('=')[1]);
if (!Number.isInteger(id) || id <= 0) {
  console.error('✖ Indica el lugar: npm run ver-fotos -- --id=48');
  process.exit(1);
}

const cliente = await conectar();
try {
  await cliente.query('set default_transaction_read_only = on');
  const { rows: [lugar] } = await cliente.query('select nombre from poi where id_poi = $1', [id]);
  console.log(`\nLugar #${id}: ${lugar?.nombre ?? '(no existe)'}`);
  const { rows } = await cliente.query(
    'select orden, leyenda, url from poi_foto where poi_id = $1 order by orden',
    [id],
  );
  if (rows.length === 0) console.log('Sin fotos.');
  for (const foto of rows) {
    // Se prueba como la app en Android (okhttp) y con un agente identificado.
    const probar = async (agente) => {
      try {
        const r = await fetch(foto.url, { headers: { 'User-Agent': agente }, redirect: 'follow' });
        return `${r.status} ${r.headers.get('content-type') ?? ''} ${r.headers.get('content-length') ?? '?'} bytes`;
      } catch (error) {
        return `sin respuesta (${error.message})`;
      }
    };
    console.log(`\n[${foto.orden}] ${foto.leyenda ?? ''}\n    ${foto.url}`);
    console.log(`    okhttp (app Android) → ${await probar('okhttp/4.12.0')}`);
    console.log(`    OmniTravel           → ${await probar('OmniTravel-UQ/1.0 (proyecto academico Universidad del Quindio)')}`);
  }
} finally {
  await cliente.end();
}
