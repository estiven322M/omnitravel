#!/usr/bin/env node
/**
 * Complementa la base con lugares REALES de Armenia tomados de OpenStreetMap
 * (Overpass API) para cubrir todas las categorías de la app: restaurantes,
 * hoteles, museos y parques (las atracciones ya las carga `cargar-lugares`).
 *
 * - Solo lugares con nombre propio dentro del casco urbano de Armenia.
 * - Prioriza los que tienen dato de accesibilidad en OSM (wheelchair=*) y
 *   dirección registrada; no repite nombres que ya estén en la base.
 * - Accesibilidad: si OSM trae wheelchair/toilets:wheelchair se usa ese dato
 *   real; si no, valores iniciales por categoría que la comunidad confirma
 *   con el Proceso 1.
 *
 *   npm run complementar-lugares                  # simulación (no guarda)
 *   npm run complementar-lugares -- --confirmar   # aplica en una transacción
 */
import { conectar } from './conexion.mjs';

const confirmar = process.argv.includes('--confirmar');
const AGENTE =
  'OmniTravel-UQ/1.0 (proyecto academico Universidad del Quindio; https://github.com/estiven322M/omnitravel)';
/** Casco urbano de Armenia: sur, oeste, norte, este. */
const CAJA = '4.495,-75.725,4.580,-75.635';
const CUPOS = { restaurante: 10, hotel: 6, museo: 5, parque: 5 };
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CONSULTA = `[out:json][timeout:90];
(
  nwr["amenity"="restaurant"]["name"](${CAJA});
  nwr["tourism"="hotel"]["name"](${CAJA});
  nwr["tourism"="museum"]["name"](${CAJA});
  nwr["leisure"="park"]["name"](${CAJA});
);
out center tags;`;

async function consultarOverpass() {
  for (const servidor of SERVIDORES) {
    try {
      const respuesta = await fetch(servidor, {
        method: 'POST',
        headers: { 'User-Agent': AGENTE, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(CONSULTA)}`,
      });
      if (respuesta.ok) {
        return (await respuesta.json()).elements ?? [];
      }
      console.warn(`  ⚠ ${new URL(servidor).host} respondió ${respuesta.status}; se prueba otro servidor.`);
    } catch (error) {
      console.warn(`  ⚠ ${new URL(servidor).host}: ${error.message}`);
    }
  }
  throw new Error('No fue posible consultar OpenStreetMap (Overpass).');
}

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Nombres que no identifican un lugar concreto. */
const GENERICO = /^(restaurante|hotel|museo|parque|parqueadero|zona verde|plazoleta)( \d+)?$/;

function tipoDe(tags) {
  if (tags.amenity === 'restaurant') return 'restaurante';
  if (tags.tourism === 'hotel') return 'hotel';
  if (tags.tourism === 'museum') return 'museo';
  if (tags.leisure === 'park') return 'parque';
  return null;
}

const COCINAS = {
  regional: 'comida típica regional',
  colombian: 'comida colombiana',
  pizza: 'pizza',
  burger: 'hamburguesas',
  italian: 'comida italiana',
  chinese: 'comida china',
  mexican: 'comida mexicana',
  japanese: 'comida japonesa',
  sushi: 'sushi',
  chicken: 'pollo',
  steak_house: 'carnes a la parrilla',
  barbecue: 'carnes a la parrilla',
  seafood: 'pescados y mariscos',
  vegetarian: 'comida vegetariana',
  coffee_shop: 'café',
  international: 'cocina internacional',
};

function descripcionDe(tipo, tags) {
  if (tipo === 'restaurante') {
    const cocina = (tags.cuisine ?? '')
      .split(';')
      .map((c) => COCINAS[c.trim()])
      .filter(Boolean);
    return cocina.length
      ? `Restaurante de ${cocina.join(' y ')} en Armenia.`
      : 'Restaurante en Armenia.';
  }
  if (tipo === 'hotel') {
    return tags.stars ? `Hotel de ${tags.stars} estrellas en Armenia.` : 'Hotel en Armenia.';
  }
  if (tipo === 'museo') return 'Museo de Armenia, Quindío.';
  return 'Parque urbano de Armenia.';
}

function direccionDe(tags) {
  const calle = tags['addr:street'];
  if (calle) {
    return `${calle}${tags['addr:housenumber'] ? ` #${tags['addr:housenumber']}` : ''}, Armenia`;
  }
  return tags['addr:full'] ?? 'Armenia, Quindío';
}

/**
 * Características: 1 rampa · 2 ascensor · 3 baño adaptado · 4 Braille ·
 * 5 podotáctil · 6 semáforo sonoro · 7 ancho de puerta (cm).
 */
const BASE = {
  restaurante: { 1: true, 2: false, 3: false, 4: false, 5: false, 6: false, 7: 90 },
  hotel: { 1: true, 2: true, 3: true, 4: false, 5: false, 6: false, 7: 90 },
  museo: { 1: true, 2: true, 3: true, 4: false, 5: true, 6: false, 7: 110 },
  parque: { 1: true, 2: false, 3: false, 4: false, 5: false, 6: true, 7: 200 },
};

function valoresDe(tipo, tags) {
  const valores = { ...BASE[tipo] };
  if (tags.wheelchair === 'yes') {
    Object.assign(valores, { 1: true, 7: Math.max(valores[7], 90) });
  } else if (tags.wheelchair === 'limited') {
    Object.assign(valores, { 1: true, 7: 80 });
  } else if (tags.wheelchair === 'no') {
    Object.assign(valores, { 1: false, 7: 70 });
  }
  if (tags['toilets:wheelchair'] === 'yes') valores[3] = true;
  if (tags['toilets:wheelchair'] === 'no') valores[3] = false;
  return valores;
}

/** Mayor puntaje = más información en OSM (y por tanto más confiable). */
function puntaje(tags) {
  return (
    (tags.wheelchair ? 4 : 0) +
    (tags['addr:street'] ? 2 : 0) +
    (tags.website || tags['contact:website'] || tags.phone || tags['contact:phone'] ? 1 : 0) +
    (tags.cuisine || tags.stars ? 1 : 0)
  );
}

async function main() {
  console.log(confirmar ? '▶ Modo: APLICAR cambios' : '▶ Modo: SIMULACIÓN (no se guarda nada)');
  console.log('\nConsultando OpenStreetMap (restaurantes, hoteles, museos y parques de Armenia)…');
  const elementos = await consultarOverpass();

  const cliente = await conectar();
  try {
    const { rows: existentes } = await cliente.query('select nombre from poi');
    const vistos = new Set(existentes.map((fila) => normalizar(fila.nombre)));

    const candidatos = elementos
      .map((elemento) => {
        const tags = elemento.tags ?? {};
        const tipo = tipoDe(tags);
        const lat = elemento.lat ?? elemento.center?.lat;
        const lon = elemento.lon ?? elemento.center?.lon;
        return { tags, tipo, lat, lon, nombre: (tags.name ?? '').trim() };
      })
      .filter((c) => c.tipo && c.lat && c.lon && c.nombre.length >= 4)
      .filter((c) => !GENERICO.test(normalizar(c.nombre)))
      .sort((a, b) => puntaje(b.tags) - puntaje(a.tags) || a.nombre.localeCompare(b.nombre));

    const elegidos = [];
    const porTipo = {};
    for (const candidato of candidatos) {
      const clave = normalizar(candidato.nombre);
      if (vistos.has(clave) || (porTipo[candidato.tipo] ?? 0) >= CUPOS[candidato.tipo]) continue;
      vistos.add(clave);
      porTipo[candidato.tipo] = (porTipo[candidato.tipo] ?? 0) + 1;
      elegidos.push(candidato);
    }

    console.log(`\nOSM devolvió ${elementos.length} lugares; se eligen ${elegidos.length}:`);
    console.table(
      elegidos.map((c) => ({
        tipo: c.tipo,
        nombre: c.nombre.slice(0, 40),
        lat: c.lat.toFixed(5),
        lon: c.lon.toFixed(5),
        silla: c.tags.wheelchair ?? '—',
        direccion: direccionDe(c.tags).slice(0, 34),
      })),
    );

    await cliente.query('begin');
    for (const c of elegidos) {
      const { rows } = await cliente.query(
        `insert into poi (nombre, descripcion, tipo, direccion, ubicacion, estado)
         values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), 'publicado')
         returning id_poi::int as id`,
        [c.nombre, descripcionDe(c.tipo, c.tags), c.tipo, direccionDe(c.tags), c.lon, c.lat],
      );
      for (const [caracteristica, valor] of Object.entries(valoresDe(c.tipo, c.tags))) {
        await cliente.query(
          `insert into valor_accesibilidad_poi (poi_id, caracteristica_id, valor_booleano, valor_numerico)
           values ($1, $2, $3, $4)`,
          [rows[0].id, Number(caracteristica), typeof valor === 'boolean' ? valor : null, typeof valor === 'number' ? valor : null],
        );
      }
    }

    const { rows: resumen } = await cliente.query(
      'select tipo, count(*)::int as lugares from poi group by tipo order by tipo',
    );
    console.log('\nLugares por categoría al terminar:');
    console.table(resumen);

    if (confirmar) {
      await cliente.query('commit');
      console.log('\n✔ Cambios guardados.');
    } else {
      await cliente.query('rollback');
      console.log('\nSimulación: no se guardó nada. Para aplicar: npm run complementar-lugares -- --confirmar');
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
