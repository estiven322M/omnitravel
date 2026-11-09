#!/usr/bin/env node
/**
 * Auditoría automática de accesibilidad de la versión web (RNF-11, RNF-12 y
 * riesgo 11 de la auditoría): recorre las pantallas principales de los dos
 * roles y ejecuta axe-core con las reglas WCAG 2.0/2.1 A y AA (incluye
 * contraste de color, nombres accesibles, roles y etiquetas de formularios).
 *
 * La API se simula con datos de ejemplo para que la prueba sea repetible y no
 * dependa de la base de producción. Escribe el informe en
 * `resultados/informe.md` y `resultados/axe.json`, y capturas por pantalla.
 *
 *   npx expo export -p web   (en mobile-app; la URL de la API no importa)
 *   npm run auditar -- --dist ../../mobile-app/dist
 *
 * Sale con código 1 si hay violaciones «serious» o «critical».
 */
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const argDist = process.argv.indexOf('--dist');
const DIST = resolve(argDist > 0 ? process.argv[argDist + 1] : '../../mobile-app/dist');
const SALIDA = resolve('resultados');
const REGLAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// --- Servidor estático de dist/ (rutas desconocidas → index.html) ----------
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const servidor = createServer(async (req, res) => {
  let ruta = join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!ruta.startsWith(DIST)) ruta = join(DIST, 'index.html');
  try {
    if (!(await stat(ruta)).isFile()) throw new Error();
  } catch {
    ruta = join(DIST, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] ?? 'application/octet-stream' });
  createReadStream(ruta).pipe(res);
});
await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo));
const WEB = `http://127.0.0.1:${servidor.address().port}`;

// --- API simulada ------------------------------------------------------------
const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = (rol) =>
  `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: '7', rol, exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
const CARACTERISTICAS = ['Tiene rampa', 'Tiene ascensor', 'Tiene baño adaptado', 'Tiene menú Braille', 'Tiene piso podotáctil', 'Tiene semáforo sonoro', 'Ancho de puerta']
  .map((nombre, i) => ({ id_caracteristica: i + 1, nombre, descripcion: null, tipo_valor: i === 6 ? 'numerico' : 'booleano', activa: true }));
const LUGARES = [
  ['Museo del Oro Quimbaya', 'museo', 4.5506, -75.6577],
  ['Parque de la Vida', 'parque', 4.5462, -75.6593],
  ['Plaza de Bolívar', 'atraccion', 4.5339, -75.6727],
  ['Cibus', 'restaurante', 4.53867, -75.66641],
  ['Hotel Zatama', 'hotel', 4.53506, -75.67181],
];
const MAPA = {
  caracteristicas: CARACTERISTICAS,
  pois: LUGARES.map(([nombre, tipo, lat, lon], i) => ({
    id_poi: i + 1, nombre, descripcion: `${nombre} en Armenia.`, tipo, direccion: 'Armenia, Quindío',
    ubicacion: { type: 'Point', coordinates: [lon, lat] }, estado: 'publicado',
    fecha_creacion: '2026-11-01T00:00:00Z', fecha_actualizacion: '2026-11-08T00:00:00Z',
  })),
  valores: LUGARES.flatMap((_, i) => CARACTERISTICAS.map((c, j) => ({
    id_valor: i * 10 + j, poi_id: i + 1, caracteristica_id: c.id_caracteristica,
    valor_texto: null, valor_numerico: j === 6 ? 95 : null, valor_booleano: j === 6 ? null : j % 2 === 0,
    fecha_actualizacion: '2026-11-08T00:00:00Z',
  }))),
  retroalimentacion: [{ id_retroalimentacion: 1, usuario_id: 3, poi_id: 1, calificacion: 5, comentario: 'Rampa amplia y baño accesible.', fecha: '2026-11-07T15:00:00Z' }],
  reportes: [],
  confirmaciones: [],
  fotos: [],
};
const RESPUESTAS = {
  '/mapa': MAPA,
  '/moderacion/resumen': { pendientes: 2, discrepancias: 1, verificadosHoy: 3, alertasCriticas: [], actividadReciente: [], desempeno: { tasaResolucion: 80, procesadosMes: 12, procesadosMesAnterior: 9, horasPromedio: 2.5 } },
  '/moderacion/estadisticas': {
    reportesPorEstado: [{ estado: 'publicado', total: 8 }, { estado: 'pendiente_validacion', total: 2 }, { estado: 'rechazado', total: 1 }],
    actividad: Array.from({ length: 7 }, (_, i) => ({ dia: `2026-11-0${i + 2}`, recibidos: i % 3, resueltos: (i + 1) % 2 })),
    incidenciasPorGravedad: [{ gravedad: 'media', total: 1 }], lugaresPorEstado: [{ estado: 'publicado', total: 5 }],
    experiencias: { total: 4, promedio: 4.2 }, viasResolucion: [{ via: 'automatica', total: 6 }, { via: 'manual', total: 2 }],
  },
};
function responderApi(ruta, url) {
  if (ruta === '/auth/login') {
    const rol = JSON.parse(url.postData() ?? '{}').email?.startsWith('moderador') ? 'moderador' : 'viajero';
    return { token: token(rol), usuario: { id_usuario: 7, email: 'prueba@omnitravel.test', rol_id: rol === 'moderador' ? 4 : 1, rol } };
  }
  return RESPUESTAS[ruta] ?? [];
}

// --- Recorrido ---------------------------------------------------------------
mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch();
const resultados = [];

async function auditar(pagina, nombre) {
  await pagina.waitForTimeout(1200);
  await pagina.addScriptTag({ content: AXE });
  const r = await pagina.evaluate(
    (etiquetas) => window.axe.run(document, { runOnly: { type: 'tag', values: etiquetas } }),
    REGLAS,
  );
  await pagina.screenshot({ path: join(SALIDA, `${nombre.replace(/\W+/g, '-').toLowerCase()}.png`) });
  resultados.push({ pantalla: nombre, violaciones: r.violations, aprobadas: r.passes.length });
  const graves = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).length;
  console.log(`${graves ? '✖' : '✔'} ${nombre}: ${r.passes.length} reglas cumplidas, ${r.violations.length} con hallazgos (${graves} graves)`);
}

async function nuevaPagina() {
  const contexto = await navegador.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-CO' });
  // Cualquier petición fuera del servidor local es la API (sea cual sea la
  // EXPO_PUBLIC_API_URL con que se compiló la web).
  await contexto.route((url) => url.origin !== WEB && !/openstreetmap|jsdelivr|wikimedia/.test(url.host), (ruta) => {
    const peticion = ruta.request();
    const cors = {
      'Access-Control-Allow-Origin': WEB,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    };
    if (peticion.method() === 'OPTIONS') {
      ruta.fulfill({ status: 204, headers: cors });
      return;
    }
    const camino = new URL(peticion.url()).pathname;
    ruta.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(responderApi(camino, peticion)) });
  });
  // Teselas y librerías externas del mapa: sin red en la prueba.
  await contexto.route(/tile\.openstreetmap\.org|cdn\.jsdelivr\.net|upload\.wikimedia\.org/, (r) => r.fulfill({ status: 204 }));
  return contexto.newPage();
}

async function iniciarSesion(pagina, email) {
  await pagina.goto(WEB);
  await pagina.getByText('Comenzar', { exact: true }).click();
  if (email.startsWith('moderador')) {
    await pagina.getByText('Moderador', { exact: true }).click();
  }
  await pagina.getByLabel('Email').fill(email);
  await pagina.getByLabel('Contraseña', { exact: true }).fill('Clave123!');
  await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();
  await pagina.waitForTimeout(1500);
}

async function irAPestana(pagina, nombre) {
  // Barra inferior: según la plataforma web, cada pestaña es tab, link o button.
  const patron = new RegExp(nombre, 'i');
  const candidatos = pagina
    .getByRole('tab', { name: patron })
    .or(pagina.getByRole('link', { name: patron }))
    .or(pagina.getByRole('button', { name: patron }));
  await candidatos.last().click();
}

try {
  // Viajero
  let pagina = await nuevaPagina();
  await pagina.goto(WEB);
  await auditar(pagina, 'U01 Presentación');
  await pagina.getByText('Comenzar', { exact: true }).click();
  await auditar(pagina, 'U02 Inicio de sesión');
  await pagina.getByLabel('Crear una cuenta').click();
  await auditar(pagina, 'U03 Registro');
  await pagina.close();

  pagina = await nuevaPagina();
  await iniciarSesion(pagina, 'viajera@omnitravel.test');
  await auditar(pagina, 'U04 Inicio (viajero)');
  for (const [pestana, nombre] of [['Mapa', 'U06 Mapa'], ['Contribuir', 'U09 Contribuir'], ['Guardados', 'Guardados'], ['Perfil', 'U05 Perfil']]) {
    await irAPestana(pagina, pestana);
    await auditar(pagina, nombre);
  }
  await pagina.close();

  // Moderador
  pagina = await nuevaPagina();
  await iniciarSesion(pagina, 'moderador@omnitravel.test');
  await auditar(pagina, 'M02 Panel del moderador');
  for (const [pestana, nombre] of [['Reportes', 'M03 Reportes'], ['Estad', 'M07 Estadísticas']]) {
    await irAPestana(pagina, pestana);
    await auditar(pagina, nombre);
  }
} finally {
  await navegador.close();
  servidor.close();
}

// --- Informe -----------------------------------------------------------------
writeFileSync(join(SALIDA, 'axe.json'), JSON.stringify(resultados, null, 2));
const totalGraves = resultados.flatMap((r) => r.violaciones).filter((v) => ['serious', 'critical'].includes(v.impact)).length;
const filas = resultados.map((r) => {
  const graves = r.violaciones.filter((v) => ['serious', 'critical'].includes(v.impact));
  return `| ${r.pantalla} | ${r.aprobadas} | ${r.violaciones.length} | ${graves.length} | ${r.violaciones.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`).join('; ') || '—'} |`;
});
writeFileSync(join(SALIDA, 'informe.md'), [
  '# Auditoría automática de accesibilidad (axe-core, WCAG 2.1 AA)',
  '',
  `Fecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · axe-core ${JSON.parse(readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version} · Chromium · 412×915 px`,
  '',
  '| Pantalla | Reglas cumplidas | Reglas con hallazgos | Graves | Detalle (regla, impacto, elementos) |',
  '|---|---|---|---|---|',
  ...filas,
  '',
  `**Hallazgos graves (serious/critical): ${totalGraves}**`,
].join('\n'));
console.log(`\nInforme: ${join(SALIDA, 'informe.md')}`);
process.exitCode = totalGraves > 0 ? 1 : 0;
