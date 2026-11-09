import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const CARPETA_SQL = join(__dirname, '..', '..', 'sql');

export const MODERADOR = {
  email: 'moderador.integracion@omnitravel.test',
  password: 'Moderador123!',
};

/**
 * Deja una base PostgreSQL/PostGIS vacía con el esquema REAL del proyecto:
 * aplica en orden las migraciones versionadas (sql/000…NNN), los catálogos y
 * un moderador. Así las pruebas de integración usan las mismas tablas,
 * restricciones e índices que producción, no un esquema simulado.
 */
export async function prepararBaseDeDatos(url: string): Promise<void> {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query(
      'drop schema if exists public cascade; create schema public;',
    );
    const migraciones = readdirSync(CARPETA_SQL)
      .filter((nombre) => /^\d{3}-.+\.sql$/.test(nombre))
      .sort();
    for (const archivo of [...migraciones, 'catalogos.sql']) {
      await cliente.query(readFileSync(join(CARPETA_SQL, archivo), 'utf8'));
    }
    await cliente.query(
      `insert into usuario (email, password_hash, rol_id, estado_cuenta)
       select $1, $2, id_rol, 'activo' from rol where nombre_rol = 'moderador'`,
      [MODERADOR.email, bcrypt.hashSync(MODERADOR.password, 4)],
    );
  } finally {
    await cliente.end();
  }
}

/** Consulta directa para verificar lo que quedó guardado en la base. */
export async function consultar<T = Record<string, unknown>>(
  url: string,
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(sql, parametros);
    return rows as T[];
  } finally {
    await cliente.end();
  }
}

/** Inserta un lugar publicado con su ubicación (para los flujos del mapa y P3). */
export async function crearLugar(url: string, nombre: string): Promise<number> {
  const [fila] = await consultar<{ id: number }>(
    url,
    `insert into poi (nombre, descripcion, tipo, direccion, ubicacion, estado)
     values ($1, 'Lugar de prueba de integración', 'museo', 'Armenia, Quindío',
             ST_SetSRID(ST_MakePoint(-75.6727, 4.5339), 4326), 'publicado')
     returning id_poi::int as id`,
    [nombre],
  );
  return fila.id;
}
