#!/usr/bin/env node
/**
 * Asigna una contraseña nueva a una cuenta existente (p. ej. si la persona
 * olvidó la que usaba en la app anterior). Solo lo puede hacer alguien con
 * acceso a la base de datos.
 *
 *   npm run restablecer-clave -- correo@dominio.co
 *
 * - Pide la contraseña nueva dos veces sin mostrarla en pantalla (o la toma
 *   de NUEVA_CLAVE, útil en scripts).
 * - Exige la misma política que el registro de la app.
 * - No cambia el rol ni los datos de la cuenta; la reactiva si estaba
 *   bloqueada.
 *
 * Usa DATABASE_URL, DB_SSL y DB_SSL_CA de backend/.env, igual que el backend.
 */
import { readFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function salir(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

/** Misma política que el registro de la app (auth.service.ts). */
export function contrasenaValida(clave) {
  return (
    clave.length >= 8 &&
    /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(clave) &&
    /\d/.test(clave) &&
    /[^A-Za-z0-9\s]/.test(clave)
  );
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

/** Lee una línea sin eco (la contraseña no queda en pantalla ni en el historial). */
function preguntarOculto(pregunta) {
  return new Promise((resolve) => {
    stdout.write(pregunta);
    let valor = '';
    const crudo = stdin.isTTY;
    if (crudo) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding('utf8');
    const alEscribir = (tecla) => {
      for (const caracter of tecla) {
        if (caracter === '\n' || caracter === '\r' || caracter === '\u0004') {
          if (crudo) {
            stdin.setRawMode(false);
          }
          stdin.pause();
          stdin.off('data', alEscribir);
          stdout.write('\n');
          resolve(valor);
          return;
        }
        if (caracter === '\u0003') {
          stdout.write('\n');
          process.exit(130);
        }
        if (caracter === '\u007f') {
          valor = valor.slice(0, -1);
        } else {
          valor += caracter;
        }
      }
    };
    stdin.on('data', alEscribir);
  });
}

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    salir('Uso: npm run restablecer-clave -- correo@dominio.co');
  }
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
      'select id_usuario from usuario where lower(email) = $1',
      [email],
    );
    if (rows.length === 0) {
      salir(`No existe una cuenta con el correo ${email}.`);
    }

    const clave = process.env.NUEVA_CLAVE ?? (await preguntarOculto('Contraseña nueva: '));
    if (!contrasenaValida(clave)) {
      salir('La contraseña debe tener mínimo 8 caracteres, con letras, números y un símbolo.');
    }
    if (!process.env.NUEVA_CLAVE) {
      const repetida = await preguntarOculto('Repite la contraseña: ');
      if (repetida !== clave) {
        salir('Las contraseñas no coinciden.');
      }
    }

    await cliente.query(
      `update usuario set password_hash = $1, estado_cuenta = 'activo' where id_usuario = $2`,
      [await bcrypt.hash(clave, 10), rows[0].id_usuario],
    );
    console.log(`✔ Contraseña actualizada para ${email}. Ya puede iniciar sesión con la nueva.`);
  } finally {
    await cliente.end();
  }
}

main().catch((error) => salir(error.message));
