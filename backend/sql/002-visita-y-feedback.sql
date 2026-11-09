-- OmniTravel · migración 002 (AWS RDS, base omnitravel_db)
--
-- Proceso 3 — retroalimentación e incidencias post-viaje:
--   * `visita` registra el inicio y el fin de una visita real a un POI.
--   * `retroalimentacion.visita_id` vincula cada opinión con la visita que la
--     autoriza; una visita solo puede calificarse una vez (índice único).
--   * Solo las visitas en estado 'completada' aceptan retroalimentación.
--
-- Aditiva e idempotente: puede ejecutarse varias veces sin efecto adicional.
-- Ya aplicada en omnitravel_db el 2026-11-08.

begin;

create table if not exists public.visita (
  id_visita bigint generated always as identity,
  usuario_id bigint not null
    references public.usuario(id_usuario) on delete cascade,
  poi_id bigint not null
    references public.poi(id_poi) on delete cascade,
  estado text not null default 'en_curso',
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  constraint visita_pkey primary key (id_visita),
  constraint visita_estado_check
    check (estado in ('en_curso', 'completada', 'cancelada')),
  constraint visita_fechas_check check (
    (estado = 'en_curso' and fecha_fin is null)
    or (estado <> 'en_curso' and fecha_fin is not null)
  )
);

create index if not exists idx_visita_usuario
  on public.visita (usuario_id, fecha_inicio desc);
create index if not exists idx_visita_poi
  on public.visita (poi_id, fecha_inicio desc);

-- Un viajero solo puede tener una visita en curso; al iniciar otra, la
-- anterior se cierra como 'cancelada' dentro de la misma transacción.
create unique index if not exists visita_en_curso_por_usuario
  on public.visita (usuario_id) where estado = 'en_curso';

alter table public.retroalimentacion
  add column if not exists visita_id bigint
    references public.visita(id_visita) on delete set null;

create unique index if not exists retroalimentacion_visita_id_key
  on public.retroalimentacion (visita_id) where visita_id is not null;

-- Backfill: las opiniones existentes reciben una visita completada sintética
-- para que el histórico siga siendo coherente con el nuevo modelo.
do $$
declare
  opinion record;
  nueva_visita bigint;
begin
  for opinion in
    select id_retroalimentacion, usuario_id, poi_id, fecha
      from public.retroalimentacion
     where visita_id is null and usuario_id is not null
  loop
    insert into public.visita
      (usuario_id, poi_id, estado, fecha_inicio, fecha_fin)
    values
      (opinion.usuario_id, opinion.poi_id, 'completada',
       opinion.fecha - interval '45 minutes', opinion.fecha)
    returning id_visita into nueva_visita;

    update public.retroalimentacion
       set visita_id = nueva_visita
     where id_retroalimentacion = opinion.id_retroalimentacion;
  end loop;
end $$;

commit;
