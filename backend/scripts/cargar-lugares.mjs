#!/usr/bin/env node
/**
 * Carga los lugares reales de Armenia (scripts/datos/lugares-armenia.mjs):
 *
 * 1. Busca las coordenadas de cada lugar en OpenStreetMap (Nominatim).
 * 2. Obtiene sus fotos de Wikimedia Commons (autor, licencia, 1280 px) y, si
 *    faltan, busca fotos geolocalizadas a menos de 250 m. Descarta las de
 *    menos de 900 px de ancho (borrosas).
 * 3. En una transacción: elimina los lugares de prueba (ELIMINAR_IDS) con sus
 *    datos de prueba, corrige los que se reutilizan, crea los nuevos, y
 *    guarda valores de accesibilidad y fotos (tabla poi_foto, migración 003).
 *
 *   npm run cargar-lugares                  # simulación: muestra todo y deshace
 *   npm run cargar-lugares -- --confirmar   # aplica los cambios
 *
 * Necesita internet (OpenStreetMap y Wikimedia) y DATABASE_URL.
 */
import { readFileSync } from 'node:fs';
import { conectar } from './conexion.mjs';
import { ELIMINAR_IDS, LUGARES } from './datos/lugares-armenia.mjs';

const confirmar = process.argv.includes('--confirmar');
const AGENTE = 'OmniTravel-UQ/1.0 (proyecto academico, Universidad del Quindio)';
const CAJA_ARMENIA = '-75.76,4.60,-75.60,4.47'; // oeste,norte,este,sur
const ANCHO_MINIMO = 900;
const MAX_FOTOS = 3;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} en ${new URL(url).host}`);
  }
  return respuesta.json();
}

/** Coordenadas en OpenStreetMap, limitadas al área de Armenia. */
async function geocodificar(lugar) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: lugar.consulta,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'co',
    viewbox: CAJA_ARMENIA,
    bounded: '1',
  }).toString();
  await esperar(1100); // política de uso de Nominatim: 1 consulta por segundo
  try {
    const [resultado] = await json(url);
    if (resultado) {
      return {
        lat: Number(resultado.lat),
        lon: Number(resultado.lon),
        fuente: 'OSM',
        detalle: resultado.display_name.split(',').slice(0, 3).join(','),
      };
    }
  } catch (error) {
    console.warn(`  ⚠ OSM falló para ${lugar.nombre}: ${error.message}`);
  }
  return { lat: lugar.respaldo[0], lon: lugar.respaldo[1], fuente: 'aprox.', detalle: '' };
}

const sinHtml = (texto) =>
  (texto ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || null;

/** Datos de Commons de varios archivos: URL 1280 px, tamaño, autor y licencia. */
async function infoCommons(titulos) {
  if (titulos.length === 0) return [];
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1280',
    titles: titulos.join('|'),
  }).toString();
  const datos = await json(url);
  return Object.values(datos.query?.pages ?? {})
    .filter((pagina) => pagina.imageinfo?.[0])
    .map((pagina) => {
      const info = pagina.imageinfo[0];
      const meta = info.extmetadata ?? {};
      return {
        titulo: pagina.title,
        url: info.thumburl ?? info.url,
        ancho: info.width,
        alto: info.height,
        autor: sinHtml(meta.Artist?.value),
        licencia: sinHtml(meta.LicenseShortName?.value),
        fuenteUrl: info.descriptionurl,
      };
    });
}

/** Fotos de Commons geolocalizadas cerca del lugar (para los que no tienen). */
async function fotosCercanas(lat, lon) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'geosearch',
    gscoord: `${lat}|${lon}`,
    gsradius: '250',
    gsnamespace: '6',
    gslimit: '20',
  }).toString();
  const datos = await json(url);
  return (datos.query?.geosearch ?? [])
    .map((resultado) => resultado.title)
    .filter((titulo) => /\.(jpe?g)$/i.test(titulo))
    .filter((titulo) => !/logo|escudo|bandera|flag|mapa|map\b|plano/i.test(titulo));
}

const leyendaDeTitulo = (titulo) =>
  titulo
    .replace(/^File:|^Archivo:/, '')
    .replace(/\.[a-z]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();

async function fotosDe(lugar, coordenadas) {
  const elegidas = [];
  const curadas = await infoCommons(lugar.fotos.map((f) => `File:${f.archivo}`));
  for (const foto of lugar.fotos) {
    const info = curadas.find(
      (c) => c.titulo.replace(/^File:/, '').replace(/ /g, '_') === foto.archivo.replace(/ /g, '_'),
    );
    if (info && info.ancho >= ANCHO_MINIMO) {
      elegidas.push({ ...info, leyenda: foto.leyenda });
    } else {
      console.warn(`  ⚠ ${lugar.nombre}: «${foto.archivo}» no existe o es pequeña; se omite.`);
    }
  }
  if (elegidas.length < 2) {
    const cercanas = await fotosCercanas(coordenadas.lat, coordenadas.lon);
    const infos = await infoCommons(cercanas.slice(0, 15));
    for (const info of infos
      .filter((i) => i.ancho >= 1200 && i.ancho >= i.alto * 0.9)
      .sort((a, b) => b.ancho - a.ancho)) {
      if (elegidas.length >= MAX_FOTOS) break;
      if (!elegidas.some((e) => e.url === info.url)) {
        elegidas.push({ ...info, leyenda: leyendaDeTitulo(info.titulo), cercana: true });
      }
    }
  }
  return elegidas.slice(0, MAX_FOTOS);
}

/** Borra los lugares de prueba con sus datos de prueba dependientes. */
async function eliminar(cliente, ids) {
  const reportes = `select id_reporte from reporte where poi_id = any($1)`;
  const pasos = [
    `update solicitud_reverificacion set reporte_generado_id = null where reporte_generado_id in (${reportes})`,
    `delete from confirmacion where reporte_id in (${reportes})`,
    `delete from moderacion where reporte_id in (${reportes})`,
    `delete from valor_caracteristica_reporte where reporte_id in (${reportes})`,
    `delete from evidencia where reporte_id in (${reportes})`,
    `delete from reporte where poi_id = any($1)`,
    `delete from favorito where poi_id = any($1)`,
    `delete from valor_accesibilidad_poi where poi_id = any($1)`,
  ];
  for (const sql of pasos) {
    await cliente.query(sql, [ids]);
  }
  const { rowCount } = await cliente.query('delete from poi where id_poi = any($1)', [ids]);
  return rowCount;
}

async function main() {
  console.log(confirmar ? '▶ Modo: APLICAR cambios' : '▶ Modo: SIMULACIÓN (no se guarda nada)');
  console.log('\nBuscando coordenadas (OpenStreetMap) y fotos (Wikimedia Commons)…');
  const preparados = [];
  for (const lugar of LUGARES) {
    const coordenadas = await geocodificar(lugar);
    let fotos = [];
    try {
      fotos = await fotosDe(lugar, coordenadas);
    } catch (error) {
      console.warn(`  ⚠ Fotos de ${lugar.nombre}: ${error.message}`);
    }
    preparados.push({ lugar, coordenadas, fotos });
    process.stdout.write('.');
  }
  console.log('\n');

  console.table(
    preparados.map(({ lugar, coordenadas, fotos }) => ({
      lugar: lugar.nombre,
      lat: coordenadas.lat.toFixed(5),
      lon: coordenadas.lon.toFixed(5),
      coords: coordenadas.fuente,
      'resultado OSM': coordenadas.detalle.slice(0, 45),
      fotos: fotos.length,
    })),
  );
  console.log('\nFotos elegidas:');
  for (const { lugar, fotos } of preparados) {
    for (const foto of fotos) {
      console.log(
        `  ${lugar.nombre} → ${foto.titulo.replace(/^File:/, '')} (${foto.ancho}px${foto.cercana ? ', cercana' : ''})`,
      );
    }
  }

  const cliente = await conectar();
  try {
    await cliente.query('begin');
    await cliente.query(readFileSync('sql/003-poi-foto.sql', 'utf8').replace(/\bbegin;|\bcommit;/g, ''));

    const { rows: aEliminar } = await cliente.query(
      'select id_poi::int as id, nombre, estado from poi where id_poi = any($1) order by id_poi',
      [ELIMINAR_IDS],
    );
    console.log(`\nLugares de prueba que se eliminan (${aEliminar.length}):`);
    console.table(aEliminar);
    const eliminados = await eliminar(cliente, ELIMINAR_IDS);

    const resumen = [];
    for (const { lugar, coordenadas, fotos } of preparados) {
      let id = null;
      if (lugar.reutilizarId) {
        const { rows } = await cliente.query('select 1 from poi where id_poi = $1', [lugar.reutilizarId]);
        if (rows.length) id = lugar.reutilizarId;
      }
      if (!id) {
        const { rows } = await cliente.query(
          'select id_poi::int as id from poi where lower(nombre) = lower($1) order by id_poi limit 1',
          [lugar.nombre],
        );
        id = rows[0]?.id ?? null;
      }
      const datos = [
        lugar.nombre,
        lugar.descripcion,
        lugar.tipo,
        lugar.direccion,
        coordenadas.lon,
        coordenadas.lat,
      ];
      let accion;
      if (id) {
        await cliente.query(
          `update poi set nombre = $1, descripcion = $2, tipo = $3, direccion = $4,
                  ubicacion = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                  estado = 'publicado', fecha_actualizacion = now()
            where id_poi = $7`,
          [...datos, id],
        );
        accion = 'corregido';
      } else {
        const { rows } = await cliente.query(
          `insert into poi (nombre, descripcion, tipo, direccion, ubicacion, estado)
           values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'publicado')
           returning id_poi::int as id`,
          datos,
        );
        id = rows[0].id;
        accion = 'nuevo';
      }

      await cliente.query('delete from valor_accesibilidad_poi where poi_id = $1', [id]);
      for (const [caracteristica, valor] of Object.entries(lugar.valores)) {
        await cliente.query(
          `insert into valor_accesibilidad_poi (poi_id, caracteristica_id, valor_booleano, valor_numerico)
           values ($1, $2, $3, $4)`,
          [id, Number(caracteristica), typeof valor === 'boolean' ? valor : null, typeof valor === 'number' ? valor : null],
        );
      }

      await cliente.query('delete from poi_foto where poi_id = $1', [id]);
      for (const [orden, foto] of fotos.entries()) {
        await cliente.query(
          `insert into poi_foto (poi_id, url, leyenda, autor, licencia, fuente_url, orden)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [id, foto.url, foto.leyenda, foto.autor, foto.licencia, foto.fuenteUrl, orden],
        );
      }
      resumen.push({ id, lugar: lugar.nombre, accion, fotos: fotos.length });
    }

    console.log(`\nResultado (${eliminados} eliminados):`);
    console.table(resumen);
    const { rows: [{ total }] } = await cliente.query('select count(*)::int as total from poi');
    console.log(`Lugares en la base al terminar: ${total}`);

    if (confirmar) {
      await cliente.query('commit');
      console.log('\n✔ Cambios guardados.');
    } else {
      await cliente.query('rollback');
      console.log('\nSimulación: no se guardó nada. Para aplicar: npm run cargar-lugares -- --confirmar');
    }
  } catch (error) {
    await cliente.query('rollback').catch(() => {});
    console.error(`\n✖ No se aplicó nada: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
}

main();
