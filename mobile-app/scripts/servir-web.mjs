#!/usr/bin/env node
/**
 * Servidor estático de la versión web de OmniTravel (carpeta dist/ creada
 * con `npx expo export -p web`). Lo usa el servicio web de Railway.
 * Rutas desconocidas devuelven index.html (la app maneja su navegación).
 *
 *   node scripts/servir-web.mjs          # puerto $PORT o 8080
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const RAIZ = resolve('dist');
const PUERTO = Number(process.env.PORT ?? 8080);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function archivoDe(ruta) {
  const limpia = normalize(decodeURIComponent(ruta.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidato = join(RAIZ, limpia);
  if (!candidato.startsWith(RAIZ)) {
    return null;
  }
  try {
    const info = await stat(candidato);
    return info.isFile() ? candidato : null;
  } catch {
    return null;
  }
}

createServer(async (peticion, respuesta) => {
  const archivo = (await archivoDe(peticion.url ?? '/')) ?? join(RAIZ, 'index.html');
  const tipo = TIPOS[extname(archivo).toLowerCase()] ?? 'application/octet-stream';
  const conHash = archivo.includes('_expo') || /\.[0-9a-f]{20,}\./.test(archivo);
  respuesta.writeHead(200, {
    'Content-Type': tipo,
    'Cache-Control': conHash ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(archivo).pipe(respuesta);
}).listen(PUERTO, () => {
  console.log(`OmniTravel web en el puerto ${PUERTO}`);
});
