#!/usr/bin/env node
/**
 * Diagnóstico de la conexión TLS con la base de datos.
 *
 *   npm run diagnostico-ssl
 *
 * Se conecta SIN verificar el certificado, solo para leer quién lo firma, y
 * luego comprueba si la CA de DB_SSL_CA lo valida. No muestra contraseñas ni
 * escribe nada en la base.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

function urlSinParametrosSsl(url) {
  const parseada = new URL(url);
  ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'].forEach(
    (nombre) => parseada.searchParams.delete(nombre),
  );
  return parseada.toString();
}

function nombre(campo) {
  if (!campo) {
    return '(sin datos)';
  }
  return [campo.CN, campo.O, campo.OU].filter(Boolean).join(' · ');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL (revisa backend/.env).');
  }
  const url = urlSinParametrosSsl(process.env.DATABASE_URL);
  console.log(`Servidor: ${new URL(url).hostname}`);
  console.log(`DB_SSL=${process.env.DB_SSL ?? '(vacío)'} · DB_SSL_CA=${process.env.DB_SSL_CA ?? '(vacío)'}`);

  let ca = null;
  if (process.env.DB_SSL_CA) {
    const valor = process.env.DB_SSL_CA.trim();
    ca = valor.includes('BEGIN CERTIFICATE') ? valor : readFileSync(valor, 'utf8');
    const certificados = ca.match(/BEGIN CERTIFICATE/g)?.length ?? 0;
    console.log(`CA cargada: ${certificados} certificados`);
  }

  const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  const socket = cliente.connection.stream;
  let cert = socket.getPeerCertificate(true);
  console.log('\nCadena que presenta el servidor:');
  const vistos = new Set();
  let nivel = 0;
  while (cert && cert.fingerprint256 && !vistos.has(cert.fingerprint256)) {
    vistos.add(cert.fingerprint256);
    console.log(`  ${nivel}. ${nombre(cert.subject)}  ←  firmado por: ${nombre(cert.issuer)}`);
    cert = cert.issuerCertificate;
    nivel += 1;
  }
  await cliente.end();

  if (ca) {
    const verificado = await new Promise((resolve) => {
      const cli = new pg.Client({ connectionString: url, ssl: { ca, rejectUnauthorized: true } });
      cli
        .connect()
        .then(() => cli.end().then(() => resolve('✔ La CA de DB_SSL_CA valida el certificado.')))
        .catch((error) => resolve(`✖ La CA no lo valida: ${error.message}`));
    });
    console.log(`\n${verificado}`);
  }
  console.log(
    '\nSi la cadena no menciona «Amazon RDS», algo en tu red o tu antivirus está ' +
      'interceptando la conexión (inspección TLS).',
  );
}

main().catch((error) => {
  console.error(`✖ ${error.message}`);
  process.exit(1);
});
