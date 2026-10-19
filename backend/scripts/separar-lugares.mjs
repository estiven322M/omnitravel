#!/usr/bin/env node
/**
 * Separa los lugares que quedaron demasiado juntos.
 *
 * Varios lugares se crearon desde el mismo punto (la ubicación del teléfono
 * de quien reportaba), así que al pedir una ruta hacia ellos el trayecto
 * medía unos pocos metros y no se veía en el mapa. Este comando deja cada
 * lugar a una distancia mínima (600 m) del Centro de Armenia y de los demás,
 * moviendo solo los que están demasiado cerca a puntos libres alrededor del
 * centro (anillos de 0,9 a 2,7 km, dentro del área urbana).
 *
 *   npm run separar-lugares              # muestra el plan, no cambia nada
 *   npm run separar-lugares -- --aplicar # aplica el plan (en una transacción)
 *
 * Usa DATABASE_URL, DB_SSL y DB_SSL_CA de backend/.env, igual que el backend.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const APLICAR = process.argv.includes('--aplicar');
/** Origen por defecto de las rutas en la app (MapScreen: CENTRO_ARMENIA). */
const CENTRO = { lat: 4.537, lon: -75.675 };
const DISTANCIA_MINIMA_M = 600;
const ANILLOS_KM = [0.9, 1.5, 2.1, 2.7];
const PUNTOS_POR_ANILLO = 12;

function salir(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

/**
 * `pg` da prioridad a `?sslmode=…` de la URL sobre la opción `ssl` (y descarta
 * la CA). El TLS lo gobiernan DB_SSL / DB_SSL_CA, igual que en el backend.
 */
export function urlSinParametrosSsl(url) {
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
    // Sin CA, Node no reconoce la autoridad de RDS: se pide configurarla.
    return { rejectUnauthorized: true };
  }
  return {
    ca: ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : readFileSync(ca, 'utf8'),
    rejectUnauthorized: true,
  };
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaM(a, b) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Puntos libres candidatos: anillos alrededor del centro, alternando el ángulo. */
export function puntosCandidatos() {
  const puntos = [];
  ANILLOS_KM.forEach((km, anillo) => {
    for (let i = 0; i < PUNTOS_POR_ANILLO; i += 1) {
      const angulo = ((i + (anillo % 2) * 0.5) * 2 * Math.PI) / PUNTOS_POR_ANILLO;
      puntos.push({
        lat: CENTRO.lat + (km / 111.32) * Math.cos(angulo),
        lon:
          CENTRO.lon +
          (km / (111.32 * Math.cos((CENTRO.lat * Math.PI) / 180))) * Math.sin(angulo),
      });
    }
  });
  return puntos;
}

/** Plan: qué lugares se mueven y a dónde (los demás se quedan donde están). */
export function planificar(lugares) {
  const ocupados = [CENTRO];
  const libres = puntosCandidatos();
  const plan = [];
  const lejos = (punto) =>
    ocupados.every((otro) => distanciaM(punto, otro) >= DISTANCIA_MINIMA_M);

  for (const lugar of lugares) {
    if (lejos(lugar)) {
      ocupados.push(lugar);
      continue;
    }
    const indice = libres.findIndex(lejos);
    if (indice === -1) {
      throw new Error('No quedan puntos libres: aumenta ANILLOS_KM o PUNTOS_POR_ANILLO.');
    }
    const [destino] = libres.splice(indice, 1);
    ocupados.push(destino);
    plan.push({ ...lugar, nuevo: destino });
  }
  return plan;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    salir('Falta DATABASE_URL (revisa backend/.env).');
  }
  const cliente = new pg.Client({
    connectionString: urlSinParametrosSsl(process.env.DATABASE_URL),
    ssl: opcionesSsl(),
  });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(
      `select id_poi::int as id, nombre,
              ST_Y(ubicacion::geometry) as lat, ST_X(ubicacion::geometry) as lon
         from poi where ubicacion is not null order by id_poi`,
    );
    const plan = planificar(rows);
    if (plan.length === 0) {
      console.log(`✔ Los ${rows.length} lugares ya están separados (≥ ${DISTANCIA_MINIMA_M} m).`);
      return;
    }

    console.log(`Lugares a mover (${plan.length} de ${rows.length}):`);
    for (const p of plan) {
      const km = (distanciaM(CENTRO, p.nuevo) / 1000).toFixed(1);
      console.log(
        `  #${String(p.id).padEnd(3)} ${p.nombre.padEnd(32)} → ${p.nuevo.lat.toFixed(5)}, ${p.nuevo.lon.toFixed(5)}  (${km} km del centro)`,
      );
    }

    if (!APLICAR) {
      console.log('\nNo se cambió nada. Para aplicarlo: npm run separar-lugares -- --aplicar');
      return;
    }

    await cliente.query('begin');
    try {
      for (const p of plan) {
        await cliente.query(
          `update poi set ubicacion = ST_SetSRID(ST_MakePoint($1, $2), 4326),
                          fecha_actualizacion = now()
            where id_poi = $3`,
          [p.nuevo.lon, p.nuevo.lat, p.id],
        );
      }
      await cliente.query('commit');
    } catch (error) {
      await cliente.query('rollback');
      throw error;
    }
    console.log(`\n✔ ${plan.length} lugares reubicados. Recarga la app para verlos.`);
  } finally {
    await cliente.end();
  }
}

main().catch((error) => salir(error.message));
