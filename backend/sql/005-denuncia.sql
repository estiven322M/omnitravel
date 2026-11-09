-- OmniTravel · migración 005 (AWS RDS, base omnitravel_db)
--
-- C4 / A5 — Denuncias de la comunidad por información falsa o spam.
-- Una denuncia saca el reporte del consenso automático (vía A) y lo envía a
-- moderación (vía B, estado 'en_revision'). La decisión del moderador atiende
-- todas las denuncias pendientes del reporte.
-- Aditiva e idempotente: puede ejecutarse varias veces sin efecto adicional.

begin;

create table if not exists public.denuncia (
  id_denuncia bigint generated always as identity,
  reporte_id bigint not null,
  usuario_id bigint not null,
  motivo text not null,
  descripcion text,
  estado text default 'pendiente'::text not null,
  fecha_creacion timestamp with time zone default now() not null,
  fecha_resolucion timestamp with time zone,
  constraint denuncia_pkey primary key (id_denuncia),
  constraint denuncia_reporte_id_fkey foreign key (reporte_id)
    references public.reporte (id_reporte) on delete cascade,
  constraint denuncia_usuario_id_fkey foreign key (usuario_id)
    references public.usuario (id_usuario) on delete cascade,
  constraint denuncia_motivo_check check (motivo = any (array[
    'informacion_falsa'::text, 'spam'::text, 'contenido_inapropiado'::text, 'otro'::text])),
  constraint denuncia_estado_check check (estado = any (array['pendiente'::text, 'atendida'::text])),
  -- Una persona denuncia un reporte una sola vez.
  constraint denuncia_unica_por_usuario unique (reporte_id, usuario_id)
);

create index if not exists idx_denuncia_reporte_estado on public.denuncia (reporte_id, estado);

commit;
