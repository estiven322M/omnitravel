#!/usr/bin/env node
/**
 * Descarga el certificado raíz PÚBLICO de AWS RDS (global-bundle.pem) en
 * backend/certs/, para que el backend valide el TLS de la base de datos con
 * DB_SSL_CA=certs/global-bundle.pem. Lo usa el build de Railway y sirve
 * igual en cualquier computador del equipo.
 *
 *   npm run descargar-ca-rds
 */
import { mkdir, writeFile } from 'node:fs/promises';

const URL_CA = 'https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem';
const DESTINO = 'certs/global-bundle.pem';

const respuesta = await fetch(URL_CA);
if (!respuesta.ok) {
  console.error(`✖ No se pudo descargar la CA de RDS (HTTP ${respuesta.status}).`);
  process.exit(1);
}
const pem = await respuesta.text();
if (!pem.includes('BEGIN CERTIFICATE')) {
  console.error('✖ La respuesta no es un certificado PEM.');
  process.exit(1);
}
await mkdir('certs', { recursive: true });
await writeFile(DESTINO, pem);
console.log(`✔ CA de AWS RDS guardada en ${DESTINO} (${pem.length} bytes).`);
