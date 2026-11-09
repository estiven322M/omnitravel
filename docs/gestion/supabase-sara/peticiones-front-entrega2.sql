-- ============================================================================
-- OmniTravel · Peticiones del FRONT a la BD — ENTREGA 2 (Proceso 1 completo)
-- ============================================================================
-- Contexto: el front móvil necesita la vía de ESCRITURA del Proceso 1
-- (Validación Colaborativa de Infraestructura):
--   · U09/U10  crear reporte con foto + GPS + características
--   · C3       confirmaciones comunitarias con consenso de 3 (RNF-22/07/28)
--   · Vía B    decisión del moderador (M03–M05) con motivo y auditoría (RNF-05/30)
--
-- Diseño acordado (ADR de ventana): las escrituras van DIRECTAS a Supabase a
-- través de funciones RPC `security definer` (atómicas y a prueba de
-- concurrencia). NO se habilitan INSERT directos por tabla: el cliente solo
-- ejecuta `rpc/...` y lee. Esto evita carreras en el consenso y centraliza la
-- validación (la migración futura al backend NestJS no cambia el contrato).
--
-- Hechos verificados en vivo (2026-10-18, llave publishable):
--   · `reporte` (id_reporte, poi_id, usuario_creador_id, tipo, estado,
--     descripcion, fecha_creacion) — RLS sin políticas ⇒ 0 filas para el cliente
--   · `confirmacion` (id_confirmacion, reporte_id, usuario_id,
--     tipo_confirmacion, fecha)
--   · `valor_caracteristica_reporte` (id_valor_reporte, reporte_id,
--     caracteristica_id, valor_texto, valor_numerico, valor_booleano)
--   · `evidencia` (id_evidencia, reporte_id, tipo, storage_key, fecha)
--   · `poi.estado` ∈ {'publicado','pendiente'} (5 filas semilla; 4 publicados,
--     el id_poi=5 está pendiente)
--   · Roles: viajero=1, colaborador=2, establecimiento=3, moderador=4, admin=5
--   · NO existen: denuncia, decision_moderacion, auditoria_moderacion
--
-- Este script es IDEMPOTENTE: puede ejecutarse completo varias veces.
-- Ejecutar en el SQL Editor del proyecto (como postgres del dashboard).
--
-- DIARIO DE EJECUCIÓN (2026-10-18, responsable del front):
--   · EJECUTADO con ajustes: (1) §2 referenciaba es_moderador() antes de
--     crearla ⇒ se ejecutó §3 primero, luego §2 (idempotente); (2) el CHECK
--     real `reporte_estado_check` acepta {'pendiente_validacion','publicado',
--     'rechazado','en_revision'} — NO acepta 'pendiente' ⇒ las RPCs quedaron
--     con 'pendiente_validacion' (el front alinea sus literales) y la semilla
--     del POI 5 usa ese estado; (3) listar_reportes_moderación del front usa
--     'pendiente_validacion' por defecto; (4) confirmar_reporte anota
--     via_resolucion='automatica' al publicar y decidir_reporte 'manual'.
--   · Evidencias: bucket `evidencia` (publico, 5 MB, jpeg/png/webp) creado
--     junto con las 3 políticas storage §5.
--   · Verificación con la sesión real de la app: usuario_actual_id()=11;
--     crear_reporte devolvió estado 'pendiente_validacion' creando POI +
--     reporte + 2 valores; listar_reportes_moderacion sin rol ⇒
--     ACCESO_DENEGADO (correcto). Los registros de prueba se eliminaron; la
--     semilla del POI 5 queda (id_reporte=6, 0/3 confirmaciones) para la demo.
-- ============================================================================


-- ============================================================================
-- PASO 0 · DIAGNÓSTICO (ejecutar y LEER los resultados antes de continuar)
-- ============================================================================
-- 0.a) Si algún CHECK de estado/tipo usa valores distintos a los que asume
--      este script (marcados con  >> AJUSTAR  más abajo), corrige esas líneas
--      ANTES de ejecutar las secciones 3–4.
select c.relname as tabla, con.conname as restriccion,
       pg_get_constraintdef(con.oid) as definicion
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('poi', 'reporte', 'confirmacion', 'evidencia', 'usuario')
  and con.contype = 'c'
order by c.relname, con.conname;

-- 0.b) Columnas reales de las tablas del Proceso 1 (confirma los nombres que
--      usa este script) e idempotencia de los ALTER de la sección 1.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('reporte', 'confirmacion', 'valor_caracteristica_reporte', 'evidencia')
order by table_name, ordinal_position;

-- 0.c) Políticas actuales (no debe tocar ninguna existente de las ya aplicadas
--      el 2026-10-17; este script solo AÑADE las de las secciones 1–2).
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 0.d) Reportes semilla existentes para el POI 5 (pendiente) — informativo.
select id_reporte, poi_id, estado from public.reporte where poi_id = 5;


-- ============================================================================
-- SECCIÓN 1 · ESQUEMA MÍNIMO FALTANTE (aditivo, idempotente)
-- ============================================================================
-- 1.a) `reporte.es_critico`: bandera para la Vía B (reportes con barreras
--      críticas o incongruencias de GPS que el moderador prioriza — C5).
alter table public.reporte
  add column if not exists es_critico boolean not null default false;

-- 1.b) Tabla de decisiones de moderación (auditoría mínima, RNF-30).
--      No existía; el MER la propone como DECISION_MODERACION.
create table if not exists public.decision_moderacion (
  id_decision   bigserial primary key,
  reporte_id    bigint not null references public.reporte(id_reporte) on delete cascade,
  moderador_id  bigint not null references public.usuario(id_usuario),
  accion        text not null,
  motivo        text,
  decidido_en   timestamptz not null default now()
);
-- Valor de acción en minúsculas, consistente con el resto del esquema físico:
--   'aprobado' | 'rechazado'          >> AJUSTAR si el equipo define otros.

alter table public.decision_moderacion enable row level security;

-- 1.c) Índices de apoyo para las consultas del front (listas por POI/reporte).
create index if not exists idx_reporte_poi          on public.reporte(poi_id);
create index if not exists idx_reporte_estado       on public.reporte(estado);
create index if not exists idx_confirmacion_reporte on public.confirmacion(reporte_id);
create index if not exists idx_conf_usuario         on public.confirmacion(usuario_id);
create index if not exists idx_valor_reporte        on public.valor_caracteristica_reporte(reporte_id);
create index if not exists idx_evidencia_reporte    on public.evidencia(reporte_id);
create index if not exists idx_decision_reporte     on public.decision_moderacion(reporte_id);


-- ============================================================================
-- SECCIÓN 2 · RLS DE LECTURA (idempotente con drop + create)
-- ============================================================================
-- Los datos del crowdsourcing son públicos por diseño (mapa U06, ficha U08):
-- las confirmaciones y el conteo se muestran a la comunidad.

drop policy if exists "lectura_publica_reporte" on public.reporte;
create policy "lectura_publica_reporte"
  on public.reporte for select to anon, authenticated using (true);

drop policy if exists "lectura_publica_confirmacion" on public.confirmacion;
create policy "lectura_publica_confirmacion"
  on public.confirmacion for select to anon, authenticated using (true);

drop policy if exists "lectura_publica_valor_caracteristica_reporte" on public.valor_caracteristica_reporte;
create policy "lectura_publica_valor_caracteristica_reporte"
  on public.valor_caracteristica_reporte for select to anon, authenticated using (true);

drop policy if exists "lectura_publica_evidencia" on public.evidencia;
create policy "lectura_publica_evidencia"
  on public.evidencia for select to anon, authenticated using (true);

-- Las decisiones de moderación solo las lee el propio moderador.
drop policy if exists "lectura_decisiones_moderador" on public.decision_moderacion;
create policy "lectura_decisiones_moderador"
  on public.decision_moderacion for select to authenticated
  using (public.es_moderador());

-- Grants de tabla explícitos (Supabase los aplica por defecto; aquí van
-- declarados para evitar sorpresas con la tabla nueva).
grant select on public.decision_moderacion to authenticated;
grant select on public.reporte, public.confirmacion,
  public.valor_caracteristica_reporte, public.evidencia to anon, authenticated;


-- ============================================================================
-- SECCIÓN 3 · FUNCIONES DE APOYO
-- ============================================================================

-- 3.a) Usuario de dominio del solicitante (fila `usuario` enlazada a auth.uid()).
create or replace function public.usuario_actual_id()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select u.id_usuario
  from public.usuario u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

-- 3.b) ¿El solicitante es moderador o administrador? (RNF-23)
create or replace function public.es_moderador()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario u
    join public.rol r on r.id_rol = u.rol_id
    where u.auth_user_id = auth.uid()
      and r.nombre_rol in ('moderador', 'administrador')
  );
$$;

revoke all on function public.usuario_actual_id() from public, anon;
revoke all on function public.es_moderador() from public, anon;
grant execute on function public.usuario_actual_id() to authenticated;
grant execute on function public.es_moderador() to authenticated;


-- ============================================================================
-- SECCIÓN 4 · RPCs DEL PROCESO 1
-- ============================================================================
-- Convención de errores hacia la app:  raise exception 'CODIGO: mensaje'
-- (el front decide con CODIGO y muestra el mensaje en español).
-- Estados usados (en minúsculas como `poi.estado`):                     >> AJUSTAR
--   reporte.estado: 'pendiente' | 'publicado' | 'rechazado'
--   reporte.tipo:   'nuevo' (lugar nuevo) | 'actualizacion' (lugar existente)
--   confirmacion.tipo_confirmacion: 'confirma'
--   evidencia.tipo: 'foto'


-- 4.a) PUBLICAR REPORTE (interna) — publicación exactamente una vez (RNF-07)
create or replace function public.publicar_reporte(p_reporte_id bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_poi_id bigint;
begin
  -- Bloquea el POI: las publicaciones concurrentes sobre el mismo punto se
  -- serializan y la actualización condicional publica una sola vez.
  select r.poi_id into v_poi_id
  from public.reporte r
  where r.id_reporte = p_reporte_id;

  if v_poi_id is null then
    raise exception 'REPORTE_NO_ENCONTRADO: El reporte no existe.';
  end if;

  perform 1 from public.poi where id_poi = v_poi_id for update;

  update public.reporte
     set estado = 'publicado'                                     -- >> AJUSTAR
   where id_reporte = p_reporte_id
     and estado is distinct from 'publicado';                    -- >> AJUSTAR

  -- Copia los valores propuestos a la ficha vigente del POI (upsert manual,
  -- sin depender de constraints UNIQUE): primero actualiza, luego inserta
  -- los que falten.
  update public.valor_accesibilidad_poi v
     set valor_texto        = r.valor_texto,
         valor_numerico     = r.valor_numerico,
         valor_booleano     = r.valor_booleano,
         fecha_actualizacion = now()
    from public.valor_caracteristica_reporte r
   where v.poi_id = v_poi_id
     and r.reporte_id = p_reporte_id
     and v.caracteristica_id = r.caracteristica_id;

  insert into public.valor_accesibilidad_poi
    (poi_id, caracteristica_id, valor_texto, valor_numerico, valor_booleano, fecha_actualizacion)
  select v_poi_id, r.caracteristica_id, r.valor_texto, r.valor_numerico, r.valor_booleano, now()
  from public.valor_caracteristica_reporte r
  where r.reporte_id = p_reporte_id
    and not exists (
      select 1 from public.valor_accesibilidad_poi v
      where v.poi_id = v_poi_id and v.caracteristica_id = r.caracteristica_id
    );

  update public.poi
     set estado = 'publicado',                                    -- >> AJUSTAR
         fecha_actualizacion = now()
   where id_poi = v_poi_id
     and estado is distinct from 'publicado';                     -- >> AJUSTAR
end;
$$;

revoke all on function public.publicar_reporte(bigint) from public, anon, authenticated;


-- 4.b) CREAR REPORTE (U09/U10) — lugar nuevo o actualización de uno existente
create or replace function public.crear_reporte(
  p_poi_id              bigint default null,
  p_nombre              text   default null,
  p_tipo_poi            text   default null,   -- 'museo','parque','hotel','restaurante','atraccion'
  p_direccion           text   default null,
  p_lat                 double precision default null,
  p_lon                 double precision default null,
  p_descripcion         text   default null,
  p_tipo_reporte        text   default 'nuevo',  -- 'nuevo' | 'actualizacion'   >> AJUSTAR
  p_es_critico          boolean default false,
  p_caracteristicas     jsonb  default '[]'::jsonb,  -- [{caracteristicaId, valorBooleano?, valorNumerico?, valorTexto?}]
  p_evidencia_storage_key text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_usuario   bigint;
  v_poi_id    bigint;
  v_reporte_id bigint;
begin
  v_usuario := public.usuario_actual_id();
  if v_usuario is null then
    raise exception 'USUARIO_NO_VINCULADO: Inicia sesión de nuevo para reportar.';
  end if;

  if p_poi_id is null then
    -- Lugar nuevo: requiere nombre y coordenadas.
    if coalesce(trim(p_nombre), '') = '' or p_lat is null or p_lon is null then
      raise exception 'DATOS_INCOMPLETOS: El lugar necesita nombre y ubicación.';
    end if;

    insert into public.poi (nombre, descripcion, tipo, direccion, ubicacion, estado, fecha_creacion, fecha_actualizacion)
    values (
      trim(p_nombre),
      coalesce(p_descripcion, ''),
      coalesce(p_tipo_poi, 'atraccion'),
      coalesce(p_direccion, ''),
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      'pendiente',                                               -- >> AJUSTAR
      now(), now()
    )
    returning id_poi into v_poi_id;
  else
    v_poi_id := p_poi_id;
    if not exists (select 1 from public.poi where id_poi = v_poi_id) then
      raise exception 'POI_NO_ENCONTRADO: El lugar no existe.';
    end if;
  end if;

  insert into public.reporte
    (poi_id, usuario_creador_id, tipo, estado, descripcion, es_critico, fecha_creacion)
  values
    (v_poi_id, v_usuario, p_tipo_reporte, 'pendiente',          -- >> AJUSTAR
     coalesce(p_descripcion, ''), coalesce(p_es_critico, false), now())
  returning id_reporte into v_reporte_id;

  -- Valores declarados por el reportero (solo los que traigan datos).
  insert into public.valor_caracteristica_reporte
    (reporte_id, caracteristica_id, valor_texto, valor_numerico, valor_booleano)
  select v_reporte_id,
         (e->>'caracteristicaId')::bigint,
         e->>'valorTexto',
         nullif(e->>'valorNumerico', '')::numeric,
         nullif(e->>'valorBooleano', '')::boolean
  from jsonb_array_elements(coalesce(p_caracteristicas, '[]'::jsonb)) as e
  where e ? 'caracteristicaId';

  if coalesce(trim(p_evidencia_storage_key), '') <> '' then
    insert into public.evidencia (reporte_id, tipo, storage_key, fecha)
    values (v_reporte_id, 'foto', trim(p_evidencia_storage_key), now());
  end if;

  return jsonb_build_object(
    'id_reporte', v_reporte_id,
    'id_poi', v_poi_id,
    'estado', 'pendiente'                                       -- >> AJUSTAR
  );
end;
$$;

revoke all on function public.crear_reporte(bigint, text, text, text, double precision, double precision, text, text, boolean, jsonb, text) from public, anon;
grant execute on function public.crear_reporte(bigint, text, text, text, double precision, double precision, text, text, boolean, jsonb, text) to authenticated;


-- 4.c) CONFIRMAR REPORTE (C3) — 3 confirmaciones independientes publican (RNF-22/07/28)
create or replace function public.confirmar_reporte(p_reporte_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_usuario bigint;
  v_reporte public.reporte%rowtype;
  v_total   int;
begin
  v_usuario := public.usuario_actual_id();
  if v_usuario is null then
    raise exception 'USUARIO_NO_VINCULADO: Inicia sesión para confirmar.';
  end if;

  -- Bloqueo del reporte: serializa confirmaciones concurrentes del mismo punto.
  select * into v_reporte
  from public.reporte
  where id_reporte = p_reporte_id
  for update;

  if not found then
    raise exception 'REPORTE_NO_ENCONTRADO: El reporte no existe.';
  end if;

  if v_reporte.usuario_creador_id = v_usuario then
    raise exception 'AUTOCONFIRMACION: No puedes confirmar tu propio reporte.';
  end if;

  if v_reporte.estado = 'rechazado' then                      -- >> AJUSTAR
    raise exception 'REPORTE_RECHAZADO: Este reporte fue rechazado por moderación.';
  end if;

  if exists (
    select 1 from public.confirmacion c
    where c.reporte_id = p_reporte_id and c.usuario_id = v_usuario
  ) then
    raise exception 'CONFIRMACION_DUPLICADA: Ya confirmaste este reporte.';
  end if;

  insert into public.confirmacion (reporte_id, usuario_id, tipo_confirmacion, fecha)
  values (p_reporte_id, v_usuario, 'confirma', now());        -- >> AJUSTAR tipo_confirmacion

  select count(*) into v_total
  from public.confirmacion
  where reporte_id = p_reporte_id;

  if v_total >= 3 and v_reporte.estado is distinct from 'publicado' then
    perform public.publicar_reporte(p_reporte_id);
    return jsonb_build_object('confirmaciones', v_total, 'publicado', true);
  end if;

  return jsonb_build_object(
    'confirmaciones', v_total,
    'publicado', v_reporte.estado = 'publicado'                -- >> AJUSTAR
  );
end;
$$;

revoke all on function public.confirmar_reporte(bigint) from public, anon;
grant execute on function public.confirmar_reporte(bigint) to authenticated;


-- 4.d) DECIDIR REPORTE (Vía B, M04/M05) — decisión ejecutiva con motivo (RNF-05/30)
create or replace function public.decidir_reporte(
  p_reporte_id bigint,
  p_accion     text,   -- 'aprobado' | 'rechazado'            >> AJUSTAR
  p_motivo     text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_moderador bigint;
  v_reporte   public.reporte%rowtype;
  v_estado    text;
begin
  if not public.es_moderador() then
    raise exception 'ACCESO_DENEGADO: Solo moderación puede resolver reportes.';
  end if;

  v_moderador := public.usuario_actual_id();

  if p_accion not in ('aprobado', 'rechazado') then           -- >> AJUSTAR
    raise exception 'ACCION_INVALIDA: Acción de moderación desconocida.';
  end if;

  if p_accion = 'rechazado' and coalesce(trim(p_motivo), '') = '' then
    raise exception 'MOTIVO_REQUERIDO: El rechazo exige un motivo.';
  end if;

  select * into v_reporte
  from public.reporte
  where id_reporte = p_reporte_id
  for update;

  if not found then
    raise exception 'REPORTE_NO_ENCONTRADO: El reporte no existe.';
  end if;

  if p_accion = 'aprobado' then
    perform public.publicar_reporte(p_reporte_id);
    v_estado := 'publicado';                                  -- >> AJUSTAR
  else
    update public.reporte
       set estado = 'rechazado'                               -- >> AJUSTAR
     where id_reporte = p_reporte_id;
    v_estado := 'rechazado';                                  -- >> AJUSTAR
  end if;

  insert into public.decision_moderacion (reporte_id, moderador_id, accion, motivo, decidido_en)
  values (p_reporte_id, v_moderador, p_accion, coalesce(trim(p_motivo), ''), now());

  return jsonb_build_object('estado', v_estado);
end;
$$;

revoke all on function public.decidir_reporte(bigint, text, text) from public, anon;
grant execute on function public.decidir_reporte(bigint, text, text) to authenticated;


-- 4.e) LISTAR REPORTES PARA MODERACIÓN (M03/M04) — solo MODERADOR/ADMIN
create or replace function public.listar_reportes_moderacion(p_estado text default 'pendiente')
returns setof jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.es_moderador() then
    raise exception 'ACCESO_DENEGADO: Solo moderación puede ver los reportes.';
  end if;

  return query
  select jsonb_build_object(
    'id_reporte', r.id_reporte,
    'tipo', r.tipo,
    'estado', r.estado,
    'descripcion', r.descripcion,
    'fecha_creacion', r.fecha_creacion,
    'es_critico', r.es_critico,
    'autor', u.email,
    'confirmaciones', (select count(*) from public.confirmacion c where c.reporte_id = r.id_reporte),
    'poi', jsonb_build_object(
      'id_poi', p.id_poi,
      'nombre', p.nombre,
      'tipo', p.tipo,
      'direccion', p.direccion,
      'estado', p.estado,
      'lat', ST_Y(p.ubicacion::geometry),
      'lon', ST_X(p.ubicacion::geometry)
    ),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'caracteristica_id', v.caracteristica_id,
        'nombre', ca.nombre,
        'valor_texto', v.valor_texto,
        'valor_numerico', v.valor_numerico,
        'valor_booleano', v.valor_booleano))
      from public.valor_caracteristica_reporte v
      join public.caracteristica_accesibilidad ca on ca.id_caracteristica = v.caracteristica_id
      where v.reporte_id = r.id_reporte
    ), '[]'::jsonb),
    'evidencia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_evidencia', e.id_evidencia,
        'tipo', e.tipo,
        'storage_key', e.storage_key))
      from public.evidencia e
      where e.reporte_id = r.id_reporte
    ), '[]'::jsonb)
  )
  from public.reporte r
  join public.poi p on p.id_poi = r.poi_id
  left join public.usuario u on u.id_usuario = r.usuario_creador_id
  where p_estado is null or r.estado = p_estado
  order by r.es_critico desc, r.fecha_creacion asc;
end;
$$;

revoke all on function public.listar_reportes_moderacion(text) from public, anon;
grant execute on function public.listar_reportes_moderacion(text) to authenticated;


-- ============================================================================
-- SECCIÓN 5 · STORAGE — bucket de evidencia fotográfica (RNF-28)
-- ============================================================================
-- Bucket público de LECTURA (las fotos de infraestructura son evidencia
-- comunitaria del mapa) y subida restringida a usuarios autenticados, cada
-- uno en su carpeta `<auth.uid()>/...`, con límite de 5 MB y MIME de imagen.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencia', 'evidencia', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "evidencia_subida_autenticada" on storage.objects;
create policy "evidencia_subida_autenticada"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "evidencia_lectura_publica" on storage.objects;
create policy "evidencia_lectura_publica"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'evidencia');

drop policy if exists "evidencia_actualizacion_propia" on storage.objects;
create policy "evidencia_actualizacion_propia"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- SECCIÓN 6 · SEMILLA Y CUENTAS DE DEMOSTRACIÓN
-- ============================================================================
-- 6.a) Cuentas demo: crear 4 cuentas DESDE LA APP (registro normal) y luego
--      promover a moderador la que se use para la consola. Editar el correo:
--
-- update public.usuario set rol_id = 4 where email = 'moderador.demo@omnitravel.test';
--
--      Verificación (debe listar las cuentas con su rol):
select u.id_usuario, u.email, r.nombre_rol, u.auth_user_id is not null as vinculado
from public.usuario u
join public.rol r on r.id_rol = u.rol_id
order by u.id_usuario;

-- 6.b) Reporte semilla para el POI 5 (está en estado 'pendiente'): permite
--      demostrar el consenso de 3 confirmaciones sin depender del wizard.
--      Autor: el usuario con id_usuario más bajo (cámbialo si prefieres otro,
--      recuerda que el autor NO puede confirmar su propio reporte).
insert into public.reporte (poi_id, usuario_creador_id, tipo, estado, descripcion, es_critico, fecha_creacion)
select 5,
       (select id_usuario from public.usuario order by id_usuario limit 1),
       'actualizacion', 'pendiente',                            -- >> AJUSTAR
       'Reporte semilla de demostración: confirmar accesibilidad del acceso principal (3 confirmaciones publican el punto).',
       false,
       now()
where not exists (select 1 from public.reporte where poi_id = 5);

-- 6.c) Resultado final del script (conteos):
select
  (select count(*) from public.reporte)                                   as reportes,
  (select count(*) from public.confirmacion)                              as confirmaciones,
  (select count(*) from public.evidencia)                                 as evidencias,
  (select count(*) from public.decision_moderacion)                       as decisiones,
  (select count(*) from storage.buckets where id = 'evidencia')           as bucket_evidencia;


-- ============================================================================
-- SECCIÓN 7 · VERIFICACIÓN END-TO-END (desde la app, con la llave publishable)
-- ============================================================================
-- 1) `POST /rest/v1/rpc/crear_reporte` (sesión iniciada, con JSON de prueba)
--    → 200 con {id_reporte, id_poi, estado:'pendiente'}.
-- 2) `POST /rest/v1/rpc/confirmar_reporte` con la cuenta del reporte semilla
--    → 200; a la 3.ª confirmación de usuarios distintos: {publicado:true} y
--    el POI 5 pasa a 'publicado' en `GET /rest/v1/poi?id_poi=eq.5`.
-- 3) Confirmar el mismo reporte dos veces con el mismo usuario
--    → error 'CONFIRMACION_DUPLICADA'; con el autor → 'AUTOCONFIRMACION'.
-- 4) `POST /rest/v1/rpc/listar_reportes_moderacion` con la cuenta moderadora
--    → 200 con la lista; con una cuenta viajera → error 'ACCESO_DENEGADO'.
-- 5) Subida de foto: `POST /storage/v1/object/evidencia/<uid>/prueba.jpg`
--    → 200; archivo > 5 MB o no-imagen → rechazo del bucket (RNF-28).
-- ============================================================================
