#!/usr/bin/env node
/**
 * Crea o asciende una cuenta de moderación (M01: «Acceso exclusivo para
 * moderadores autorizados»).
 *
 * La app nunca permite registrarse como moderador o administrador: esos roles
 * solo los asigna alguien con acceso a la base de datos, con este comando.
 *
 *   npm run crear-admin -- correo@dominio.co              # administrador
 *   npm run crear-admin -- correo@dominio.co moderador    # moderador
 *
 * - Si el correo ya existe, solo cambia su rol (y reactiva la cuenta).
 * - Si no existe, crea la cuenta y pide la contraseña sin mostrarla en
 *   pantalla (o la toma de ADMIN_PASSWORD, útil en scripts de despliegue).
 *
 * Usa DATABASE_URL, DB_SSL y DB_SSL_CA de backend/.env, igual que el backend.
 */
import { readFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const ROLES_PERMITIDOS = ['moderador', 'administrador'];
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

function opcionesSsl() {
  if (process.env.DB_SSL !== 'true') {
    return false;
  }
  const ca = process.env.DB_SSL_CA?.trim();
  if (!ca) {
    return { rejectUnauthorized: true };
  }
  return { ca: ca.includes('BEGIN CERTIFICATE') ? ca : readFileSync(ca, 'utf8') };
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
  const [emailCrudo, rolCrudo = 'administrador'] = process.argv.slice(2);
  const email = (emailCrudo ?? '').trim().toLowerCase();
  const rol = rolCrudo.trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    salir('Uso: npm run crear-admin -- correo@dominio.co [moderador|administrador]');
  }
  if (!ROLES_PERMITIDOS.includes(rol)) {
    salir(`Rol no permitido: "${rol}". Usa moderador o administrador.`);
  }
  if (!process.env.DATABASE_URL) {
    salir('Falta DATABASE_URL (revisa backend/.env).');
  }

  const cliente = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: opcionesSsl(),
  });
  await cliente.connect();

  try {
    const { rows: roles } = await cliente.query(
      'select id_rol from rol where nombre_rol = $1',
      [rol],
    );
    if (roles.length === 0) {
      salir(`No existe el rol "${rol}" en la base de datos.`);
    }
    const rolId = roles[0].id_rol;

    const { rows: existentes } = await cliente.query(
      'select id_usuario from usuario where email = $1',
      [email],
    );

    if (existentes.length > 0) {
      await cliente.query(
        `update usuario set rol_id = $1, estado_cuenta = 'activo' where email = $2`,
        [rolId, email],
      );
      console.log(`✔ ${email} ahora es ${rol}. Puede entrar por el Panel de Moderación.`);
      return;
    }

    const clave = process.env.ADMIN_PASSWORD ?? (await preguntarOculto('Contraseña para la cuenta nueva: '));
    if (!contrasenaValida(clave)) {
      salir('La contraseña debe tener mínimo 8 caracteres, con letras, números y un símbolo.');
    }
    if (!process.env.ADMIN_PASSWORD) {
      const repetida = await preguntarOculto('Repite la contraseña: ');
      if (repetida !== clave) {
        salir('Las contraseñas no coinciden.');
      }
    }

    await cliente.query(
      `insert into usuario (email, password_hash, rol_id, estado_cuenta)
       values ($1, $2, $3, 'activo')`,
      [email, await bcrypt.hash(clave, 10), rolId],
    );
    console.log(`✔ Cuenta ${rol} creada para ${email}. Ya puede entrar por el Panel de Moderación.`);
  } finally {
    await cliente.end();
  }
}

main().catch((error) => salir(error.message));
