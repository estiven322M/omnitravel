-- OmniTravel · migración 000: esquema base (línea base de las migraciones)
--
-- Generado con `npm run exportar-esquema` desde la base de producción el 2026-11-08.
-- Recrea la estructura completa en una base vacía (sin datos); después se
-- aplican en orden 001, 002, 003… (npm run migrar). Usado también por las
-- pruebas de integración. Todo en una transacción: si algo falla, no queda nada.

begin;

create extension if not exists postgis;
-- pgRouting está instalada en RDS, pero el sistema no la usa: el ruteo
-- accesible lo calcula Valhalla (ADR-009). Se crea solo si el servidor la tiene.
do $$
begin
  create extension if not exists pgrouting;
exception when others then
  raise notice 'pgRouting no está disponible en este servidor (no es necesaria).';
end $$;

create table if not exists caracteristica_accesibilidad (
  id_caracteristica bigint generated always as identity,
  nombre text not null,
  descripcion text,
  tipo_valor text not null,
  activa boolean default true not null,
  constraint caracteristica_accesibilidad_tipo_valor_check CHECK ((tipo_valor = ANY (ARRAY['booleano'::text, 'numerico'::text, 'texto'::text]))),
  constraint caracteristica_accesibilidad_pkey PRIMARY KEY (id_caracteristica),
  constraint caracteristica_accesibilidad_nombre_key UNIQUE (nombre)
);

create table if not exists confirmacion (
  id_confirmacion bigint generated always as identity,
  reporte_id bigint not null,
  usuario_id bigint not null,
  tipo_confirmacion text not null,
  fecha timestamp with time zone default now() not null,
  constraint confirmacion_tipo_confirmacion_check CHECK ((tipo_confirmacion = ANY (ARRAY['confirma'::text, 'refuta'::text]))),
  constraint confirmacion_pkey PRIMARY KEY (id_confirmacion)
);

create table if not exists establecimiento_turistico (
  poi_id bigint not null,
  estado_participacion text default 'no_participante'::text not null,
  usuario_responsable_id bigint,
  fecha_registro_participacion timestamp with time zone,
  constraint establecimiento_turistico_estado_participacion_check CHECK ((estado_participacion = ANY (ARRAY['no_participante'::text, 'invitado'::text, 'activo'::text, 'inactivo'::text]))),
  constraint establecimiento_turistico_pkey PRIMARY KEY (poi_id)
);

create table if not exists evidencia (
  id_evidencia bigint generated always as identity,
  reporte_id bigint not null,
  storage_key text not null,
  tipo text not null,
  fecha timestamp with time zone default now() not null,
  constraint evidencia_tipo_check CHECK ((tipo = ANY (ARRAY['foto'::text, 'documento'::text]))),
  constraint evidencia_pkey PRIMARY KEY (id_evidencia)
);

create table if not exists favorito (
  usuario_id bigint not null,
  poi_id bigint not null,
  fecha timestamp with time zone default now() not null,
  constraint favorito_pkey PRIMARY KEY (usuario_id, poi_id)
);

create table if not exists incidencia (
  id_incidencia bigint generated always as identity,
  retroalimentacion_id bigint not null,
  tipo text not null,
  descripcion text,
  estado text default 'abierta'::text not null,
  fecha_creacion timestamp with time zone default now() not null,
  fecha_resolucion timestamp with time zone,
  constraint incidencia_estado_check CHECK ((estado = ANY (ARRAY['abierta'::text, 'en_proceso'::text, 'resuelta'::text]))),
  constraint incidencia_pkey PRIMARY KEY (id_incidencia)
);

create table if not exists moderacion (
  id_moderacion bigint generated always as identity,
  reporte_id bigint not null,
  moderador_id bigint,
  accion text not null,
  motivo text,
  fecha timestamp with time zone default now() not null,
  constraint moderacion_accion_check CHECK ((accion = ANY (ARRAY['aprobar'::text, 'rechazar'::text, 'marcar_revision'::text]))),
  constraint moderacion_pkey PRIMARY KEY (id_moderacion)
);

create table if not exists poi (
  id_poi bigint generated always as identity,
  nombre text not null,
  descripcion text,
  tipo text not null,
  direccion text,
  ubicacion geometry(Point,4326) not null,
  estado text default 'pendiente'::text not null,
  fecha_creacion timestamp with time zone default now() not null,
  fecha_actualizacion timestamp with time zone default now() not null,
  constraint poi_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'publicado'::text, 'en_revision'::text, 'rechazado'::text]))),
  constraint poi_pkey PRIMARY KEY (id_poi)
);

create table if not exists poi_foto (
  id_foto bigint generated always as identity,
  poi_id bigint not null,
  url text not null,
  leyenda text,
  autor text,
  licencia text,
  fuente_url text,
  orden integer default 0 not null,
  constraint poi_foto_pkey PRIMARY KEY (id_foto),
  constraint poi_foto_poi_url_key UNIQUE (poi_id, url)
);

create table if not exists registro_auditoria (
  id_auditoria bigint generated always as identity,
  usuario_id bigint,
  accion text not null,
  detalle jsonb,
  fecha timestamp with time zone default now() not null,
  constraint registro_auditoria_pkey PRIMARY KEY (id_auditoria)
);

create table if not exists reporte (
  id_reporte bigint generated always as identity,
  poi_id bigint not null,
  usuario_creador_id bigint,
  tipo text not null,
  descripcion text,
  estado text default 'pendiente_validacion'::text not null,
  via_resolucion text,
  fecha_creacion timestamp with time zone default now() not null,
  fecha_resolucion timestamp with time zone,
  es_critico boolean default false not null,
  constraint reporte_estado_check CHECK ((estado = ANY (ARRAY['pendiente_validacion'::text, 'publicado'::text, 'rechazado'::text, 'en_revision'::text]))),
  constraint reporte_via_resolucion_check CHECK ((via_resolucion = ANY (ARRAY['automatica'::text, 'manual'::text]))),
  constraint reporte_pkey PRIMARY KEY (id_reporte)
);

create table if not exists retroalimentacion (
  id_retroalimentacion bigint generated always as identity,
  usuario_id bigint,
  poi_id bigint not null,
  calificacion smallint not null,
  comentario text,
  fecha timestamp with time zone default now() not null,
  visita_id bigint,
  constraint retroalimentacion_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5))),
  constraint retroalimentacion_pkey PRIMARY KEY (id_retroalimentacion)
);

create table if not exists rol (
  id_rol bigint generated always as identity,
  nombre_rol text not null,
  constraint rol_nombre_rol_check CHECK ((nombre_rol = ANY (ARRAY['viajero'::text, 'colaborador'::text, 'establecimiento'::text, 'moderador'::text, 'administrador'::text]))),
  constraint rol_pkey PRIMARY KEY (id_rol),
  constraint rol_nombre_rol_key UNIQUE (nombre_rol)
);

create table if not exists solicitud_reverificacion (
  id_solicitud bigint generated always as identity,
  incidencia_id bigint not null,
  reporte_generado_id bigint,
  estado text default 'pendiente'::text not null,
  fecha_creacion timestamp with time zone default now() not null,
  fecha_resolucion timestamp with time zone,
  constraint solicitud_reverificacion_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'en_proceso'::text, 'resuelta'::text]))),
  constraint solicitud_reverificacion_pkey PRIMARY KEY (id_solicitud),
  constraint solicitud_reverificacion_incidencia_id_key UNIQUE (incidencia_id)
);

create table if not exists usuario (
  id_usuario bigint generated always as identity,
  email text not null,
  password_hash text not null,
  rol_id bigint not null,
  fecha_registro timestamp with time zone default now() not null,
  estado_cuenta text default 'activo'::text not null,
  auth_user_id uuid,
  constraint usuario_estado_cuenta_check CHECK ((estado_cuenta = ANY (ARRAY['activo'::text, 'suspendido'::text, 'eliminado'::text]))),
  constraint usuario_pkey PRIMARY KEY (id_usuario),
  constraint usuario_email_key UNIQUE (email)
);

create table if not exists valor_accesibilidad_poi (
  id_valor bigint generated always as identity,
  poi_id bigint not null,
  caracteristica_id bigint not null,
  valor_texto text,
  valor_numerico numeric,
  valor_booleano boolean,
  fecha_actualizacion timestamp with time zone default now() not null,
  constraint valor_accesibilidad_poi_pkey PRIMARY KEY (id_valor)
);

create table if not exists valor_caracteristica_reporte (
  id_valor_reporte bigint generated always as identity,
  reporte_id bigint not null,
  caracteristica_id bigint not null,
  valor_texto text,
  valor_numerico numeric,
  valor_booleano boolean,
  constraint valor_caracteristica_reporte_pkey PRIMARY KEY (id_valor_reporte)
);

create table if not exists visita (
  id_visita bigint generated always as identity,
  usuario_id bigint not null,
  poi_id bigint not null,
  estado text default 'en_curso'::text not null,
  fecha_inicio timestamp with time zone default now() not null,
  fecha_fin timestamp with time zone,
  constraint visita_estado_check CHECK ((estado = ANY (ARRAY['en_curso'::text, 'completada'::text, 'cancelada'::text]))),
  constraint visita_fechas_check CHECK ((((estado = 'en_curso'::text) AND (fecha_fin IS NULL)) OR ((estado <> 'en_curso'::text) AND (fecha_fin IS NOT NULL)))),
  constraint visita_pkey PRIMARY KEY (id_visita)
);

-- Llaves foráneas (después de crear todas las tablas)
alter table usuario add constraint usuario_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES rol(id_rol);
alter table establecimiento_turistico add constraint establecimiento_turistico_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;
alter table establecimiento_turistico add constraint establecimiento_turistico_usuario_responsable_id_fkey FOREIGN KEY (usuario_responsable_id) REFERENCES usuario(id_usuario);
alter table reporte add constraint reporte_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;
alter table reporte add constraint reporte_usuario_creador_id_fkey FOREIGN KEY (usuario_creador_id) REFERENCES usuario(id_usuario);
alter table confirmacion add constraint confirmacion_reporte_id_fkey FOREIGN KEY (reporte_id) REFERENCES reporte(id_reporte) ON DELETE CASCADE;
alter table confirmacion add constraint confirmacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario);
alter table evidencia add constraint evidencia_reporte_id_fkey FOREIGN KEY (reporte_id) REFERENCES reporte(id_reporte) ON DELETE CASCADE;
alter table moderacion add constraint moderacion_moderador_id_fkey FOREIGN KEY (moderador_id) REFERENCES usuario(id_usuario);
alter table moderacion add constraint moderacion_reporte_id_fkey FOREIGN KEY (reporte_id) REFERENCES reporte(id_reporte) ON DELETE CASCADE;
alter table retroalimentacion add constraint retroalimentacion_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;
alter table retroalimentacion add constraint retroalimentacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario);
alter table retroalimentacion add constraint retroalimentacion_visita_id_fkey FOREIGN KEY (visita_id) REFERENCES visita(id_visita) ON DELETE SET NULL;
alter table incidencia add constraint incidencia_retroalimentacion_id_fkey FOREIGN KEY (retroalimentacion_id) REFERENCES retroalimentacion(id_retroalimentacion) ON DELETE CASCADE;
alter table solicitud_reverificacion add constraint solicitud_reverificacion_incidencia_id_fkey FOREIGN KEY (incidencia_id) REFERENCES incidencia(id_incidencia) ON DELETE CASCADE;
alter table solicitud_reverificacion add constraint solicitud_reverificacion_reporte_generado_id_fkey FOREIGN KEY (reporte_generado_id) REFERENCES reporte(id_reporte);
alter table favorito add constraint favorito_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;
alter table favorito add constraint favorito_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE;
alter table registro_auditoria add constraint registro_auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario);
alter table valor_accesibilidad_poi add constraint valor_accesibilidad_poi_caracteristica_fkey FOREIGN KEY (caracteristica_id) REFERENCES caracteristica_accesibilidad(id_caracteristica);
alter table valor_accesibilidad_poi add constraint valor_accesibilidad_poi_poi_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;
alter table valor_caracteristica_reporte add constraint valor_caracteristica_reporte_caracteristica_fkey FOREIGN KEY (caracteristica_id) REFERENCES caracteristica_accesibilidad(id_caracteristica);
alter table valor_caracteristica_reporte add constraint valor_caracteristica_reporte_reporte_fkey FOREIGN KEY (reporte_id) REFERENCES reporte(id_reporte) ON DELETE CASCADE;
alter table visita add constraint visita_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;
alter table visita add constraint visita_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE;
alter table poi_foto add constraint poi_foto_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES poi(id_poi) ON DELETE CASCADE;

-- Índices
create index if not exists idx_confirmacion_reporte ON public.confirmacion USING btree (reporte_id);
create index if not exists idx_evidencia_reporte ON public.evidencia USING btree (reporte_id);
create index if not exists idx_poi_ubicacion ON public.poi USING gist (ubicacion);
create index if not exists idx_poi_foto_poi ON public.poi_foto USING btree (poi_id, orden);
create index if not exists idx_reporte_estado ON public.reporte USING btree (estado);
create index if not exists idx_reporte_poi ON public.reporte USING btree (poi_id);
create UNIQUE index if not exists retroalimentacion_visita_id_key ON public.retroalimentacion USING btree (visita_id) WHERE (visita_id IS NOT NULL);
create index if not exists idx_valor_reporte ON public.valor_caracteristica_reporte USING btree (reporte_id);
create index if not exists idx_visita_poi ON public.visita USING btree (poi_id, fecha_inicio DESC);
create index if not exists idx_visita_usuario ON public.visita USING btree (usuario_id, fecha_inicio DESC);
create UNIQUE index if not exists visita_en_curso_por_usuario ON public.visita USING btree (usuario_id) WHERE (estado = 'en_curso'::text);

-- Funciones
CREATE OR REPLACE FUNCTION public.current_app_user_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::bigint;
$function$;

CREATE OR REPLACE FUNCTION public.current_app_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anon');
$function$;

commit;
