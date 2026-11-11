#!/usr/bin/env node
/**
 * Mide con los datos reales de la BD (DATABASE_URL) los RNF que se evalúan
 * con la operación de la plataforma: RNF-03, 05, 07, 10, 14, 16, 19 y 20.
 * Solo lee. Excluye las cuentas de prueba de Postman (postman+…@omnitravel.test).
 *
 *   npm run metricas-rnf
 *
 * Cada fila muestra el criterio del Plan de Calidad, el valor medido, la
 * muestra (n) y si cumple. Con n pequeño el resultado es del piloto, no de un
 * mes de operación: así se reporta en «Evidencias métricas».
 */
import { conectar } from './conexion.mjs';

const PRUEBAS = `'postman+%@omnitravel.test'`;
const usuarioReal = (col) =>
  `(${col} is null or ${col} not in (select id_usuario from usuario where email like ${PRUEBAS}))`;

const pct = (a, b) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);
const num = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);

const cliente = await conectar();
const filas = [];
function fila(rnf, criterio, valor, n, cumple, nota = '') {
  filas.push({
    RNF: rnf,
    Criterio: criterio,
    Medido: valor == null ? 'sin datos' : valor,
    n,
    Resultado: valor == null ? '—' : cumple ? 'Cumple' : 'No cumple',
    Nota: nota,
  });
}

try {
  await cliente.query('set default_transaction_read_only = on');
  const uno = async (sql) => (await cliente.query(sql)).rows[0];

  // RNF-03: tiempo de resolución de reportes (creación → decisión) ≤ 48 h.
  const r03 = await uno(`
    select count(*)::int n,
           avg(extract(epoch from fecha_resolucion - fecha_creacion) / 3600) prom,
           percentile_cont(0.5) within group (order by extract(epoch from fecha_resolucion - fecha_creacion) / 3600) mediana,
           count(*) filter (where fecha_resolucion - fecha_creacion <= interval '48 hours')::int dentro
      from reporte
     where fecha_resolucion is not null and ${usuarioReal('usuario_creador_id')}`);
  fila('RNF-03', 'Tiempo promedio de resolución ≤ 48 h', r03.n ? `${num(r03.prom)} h` : null,
    r03.n, num(r03.prom) <= 48, `mediana ${num(r03.mediana)} h; ${pct(r03.dentro, r03.n)} % en ≤ 48 h`);

  // RNF-05: re-verificaciones resueltas en < 5 días hábiles.
  const r05 = await uno(`
    select count(*)::int n,
           count(*) filter (where (select count(*) from generate_series(fecha_creacion::date, fecha_resolucion::date - 1, '1 day') d
                                    where extract(isodow from d) < 6) < 5)::int dentro
      from solicitud_reverificacion where fecha_resolucion is not null`);
  fila('RNF-05', 'Re-verificación en < 5 días hábiles', r05.n ? `${pct(r05.dentro, r05.n)} %` : null, r05.n, pct(r05.dentro, r05.n) >= 95);

  // RNF-07: reversiones — publicados por consenso que moderación luego rechazó o envió a revisión.
  const r07 = await uno(`
    select count(*)::int n,
           count(*) filter (where r.estado in ('rechazado', 'en_revision')
                               or exists (select 1 from moderacion m where m.reporte_id = r.id_reporte
                                          and m.accion in ('rechazar', 'marcar_revision') and m.fecha > r.fecha_resolucion))::int revertidos
      from reporte r
     where r.via_resolucion = 'automatica' and r.fecha_resolucion is not null and ${usuarioReal('r.usuario_creador_id')}`);
  fila('RNF-07', 'Reversiones del consenso < 5 %', r07.n ? `${pct(r07.revertidos, r07.n)} %` : null, r07.n, pct(r07.revertidos, r07.n) < 5);

  // RNF-10: reincidencia — lugares con una incidencia resuelta que vuelven a tener otra después.
  const r10 = await uno(`
    with inc as (
      select i.id_incidencia, i.fecha_creacion, i.fecha_resolucion, f.poi_id
        from incidencia i join retroalimentacion f on f.id_retroalimentacion = i.retroalimentacion_id
       where ${usuarioReal('f.usuario_id')})
    select count(*)::int n,
           count(*) filter (where exists (select 1 from inc b where b.poi_id = a.poi_id and b.fecha_creacion > a.fecha_resolucion))::int reincide
      from inc a where a.fecha_resolucion is not null`);
  fila('RNF-10', 'Reincidencia de incidencias < 10 %', r10.n ? `${pct(r10.reincide, r10.n)} %` : null, r10.n, pct(r10.reincide, r10.n) < 10);

  // RNF-14: viajes calificados ≥ 30 %.
  const r14 = await uno(`
    select count(*)::int n,
           count(*) filter (where exists (select 1 from retroalimentacion f where f.visita_id = v.id_visita))::int calificadas
      from visita v where v.estado = 'completada' and ${usuarioReal('v.usuario_id')}`);
  fila('RNF-14', 'Viajes completados que se califican ≥ 30 %', r14.n ? `${pct(r14.calificadas, r14.n)} %` : null, r14.n, pct(r14.calificadas, r14.n) >= 30);

  // RNF-16: cobertura — lugares publicados con ficha de accesibilidad.
  const r16 = await uno(`
    select count(*)::int n,
           count(*) filter (where estado = 'publicado'
                               and exists (select 1 from valor_accesibilidad_poi v where v.poi_id = p.id_poi))::int con_ficha
      from poi p`);
  fila('RNF-16', 'Lugares con ficha validada ≥ 60 %', r16.n ? `${pct(r16.con_ficha, r16.n)} %` : null, r16.n, pct(r16.con_ficha, r16.n) >= 60,
    'sobre los lugares cargados del área piloto');

  // RNF-19: escalamiento — experiencias que abren incidencia ≤ 25 %.
  const r19 = await uno(`
    select count(*)::int n,
           count(*) filter (where exists (select 1 from incidencia i where i.retroalimentacion_id = f.id_retroalimentacion))::int escaladas
      from retroalimentacion f where ${usuarioReal('f.usuario_id')}`);
  fila('RNF-19', 'Experiencias escaladas a incidencia ≤ 25 %', r19.n ? `${pct(r19.escaladas, r19.n)} %` : null, r19.n, pct(r19.escaladas, r19.n) <= 25);

  // RNF-20: incidencias corregidas (resueltas) ≥ 90 %.
  const r20 = await uno(`
    select count(*)::int n, count(*) filter (where i.estado = 'resuelta')::int resueltas
      from incidencia i join retroalimentacion f on f.id_retroalimentacion = i.retroalimentacion_id
     where ${usuarioReal('f.usuario_id')}`);
  fila('RNF-20', 'Incidencias corregidas ≥ 90 %', r20.n ? `${pct(r20.resueltas, r20.n)} %` : null, r20.n, pct(r20.resueltas, r20.n) >= 90);

  const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  console.log(`\n=== Métricas de RNF con datos de producción · ${fecha}`);
  console.table(filas);
} finally {
  await cliente.end();
}
