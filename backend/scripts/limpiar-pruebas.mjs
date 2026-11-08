#!/usr/bin/env node
/**
 * Borra los datos que crean las pruebas funcionales de Postman: las cuentas
 * `postman+…@omnitravel.test` y todo lo que hicieron (reportes,
 * confirmaciones, experiencias post-viaje, incidencias, favoritos).
 * Úsalo antes de la sustentación para que el mapa y M06 muestren solo datos reales.
 *
 *   npm run limpiar-pruebas               # solo muestra qué se borraría
 *   npm run limpiar-pruebas -- --confirmar  # borra (en una transacción)
 *
 * Solo toca cuentas con correo `postman+%@omnitravel.test`. Si algo falla,
 * la transacción se deshace y la base queda como estaba.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const PATRON = 'postman+%@omnitravel.test';
const confirmar = process.argv.includes('--confirmar');

function salir(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

function urlSinParametrosSsl(url) {
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
    return { rejectUnauthorized: true };
  }
  return {
    ca: ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : readFileSync(ca, 'utf8'),
    rejectUnauthorized: true,
  };
}

/** Borrados en orden de dependencias. `$1` = ids de usuario de prueba (bigint[]). */
const PASOS = [
  {
    nombre: 'solicitudes de re-verificación ligadas a reportes de prueba (se desligan)',
    sql: `update solicitud_reverificacion set reporte_generado_id = null
           where reporte_generado_id in (select id_reporte from reporte where usuario_creador_id = any($1))`,
  },
  {
    nombre: 'experiencias post-viaje (con sus incidencias y solicitudes)',
    sql: `delete from retroalimentacion where usuario_id = any($1)`,
  },
  {
    nombre: 'confirmaciones',
    sql: `delete from confirmacion
           where usuario_id = any($1)
              or reporte_id in (select id_reporte from reporte where usuario_creador_id = any($1))`,
  },
  {
    nombre: 'decisiones de moderación sobre reportes de prueba',
    sql: `delete from moderacion
           where reporte_id in (select id_reporte from reporte where usuario_creador_id = any($1))`,
  },
  {
    nombre: 'valores propuestos en reportes de prueba',
    sql: `delete from valor_caracteristica_reporte
           where reporte_id in (select id_reporte from reporte where usuario_creador_id = any($1))`,
  },
  {
    nombre: 'evidencias de reportes de prueba',
    sql: `delete from evidencia
           where reporte_id in (select id_reporte from reporte where usuario_creador_id = any($1))`,
  },
  { nombre: 'reportes', sql: `delete from reporte where usuario_creador_id = any($1)` },
  { nombre: 'favoritos', sql: `delete from favorito where usuario_id = any($1)` },
];

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
    const { rows: usuarios } = await cliente.query(
      'select id_usuario from usuario where email like $1',
      [PATRON],
    );
    const ids = usuarios.map((u) => u.id_usuario);
    console.log(`Cuentas de prueba encontradas: ${ids.length}`);
    if (ids.length === 0) {
      console.log('No hay nada que limpiar.');
      return;
    }

    await cliente.query('begin');
    const resumen = [];
    for (const paso of PASOS) {
      const { rowCount } = await cliente.query(paso.sql, [ids]);
      resumen.push({ qué: paso.nombre, filas: rowCount });
    }

    // Cualquier otra tabla que apunte a usuario (p. ej. auditoría o visitas).
    const { rows: referencias } = await cliente.query(
      `select t.relname as tabla, a.attname as columna
         from pg_constraint c
         join pg_class t on t.oid = c.conrelid
         join pg_class r on r.oid = c.confrelid
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and r.relname = 'usuario'
          and t.relname not in ('retroalimentacion', 'confirmacion', 'reporte', 'favorito')`,
    );
    for (const { tabla, columna } of referencias) {
      const { rowCount } = await cliente.query(
        `delete from public."${tabla}" where "${columna}" = any($1)`,
        [ids],
      );
      resumen.push({ qué: `${tabla}.${columna}`, filas: rowCount });
    }

    const { rowCount } = await cliente.query('delete from usuario where id_usuario = any($1)', [
      ids,
    ]);
    resumen.push({ qué: 'cuentas de prueba', filas: rowCount });
    console.table(resumen);

    if (confirmar) {
      await cliente.query('commit');
      console.log('✔ Datos de prueba borrados.');
    } else {
      await cliente.query('rollback');
      console.log('Simulación: no se borró nada. Para borrar: npm run limpiar-pruebas -- --confirmar');
    }
  } catch (error) {
    await cliente.query('rollback').catch(() => {});
    throw error;
  } finally {
    await cliente.end();
  }
}

main().catch((error) => salir(error.message));
