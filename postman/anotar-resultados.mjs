// Convierte el reporte JSON de Newman en anotaciones de GitHub Actions:
// un ::error por aserción fallida y un ::notice con el resumen por caso.
// Uso: node postman/anotar-resultados.mjs reports/newman.json
import { readFileSync } from 'node:fs';

const reporte = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const lineas = [];
let casos = 0;
let casosOk = 0;
for (const ejecucion of reporte.run.executions) {
  const nombre = ejecucion.item.name;
  const aserciones = ejecucion.assertions ?? [];
  const fallas = aserciones.filter((a) => a.error);
  const codigo = ejecucion.response?.code ?? 'sin respuesta';
  const ms = ejecucion.response?.responseTime ?? '-';
  if (!nombre.startsWith('CP-F000') && !/^CP-F00[1-5]/.test(nombre)) {
    casos += 1;
    if (fallas.length === 0) casosOk += 1;
  }
  lineas.push(`${fallas.length ? 'FALLA' : 'OK'} | ${nombre} | HTTP ${codigo} | ${ms} ms`);
  for (const f of fallas) {
    console.log(`::error title=${nombre}::${f.assertion}: ${f.error.message}`);
  }
}
const t = reporte.run.stats;
console.log(
  `::notice title=Resumen Newman::Casos funcionales aprobados ${casosOk}/${casos}. ` +
    `Aserciones ${t.assertions.total - t.assertions.failed}/${t.assertions.total}. %0A` +
    lineas.join('%0A'),
);
