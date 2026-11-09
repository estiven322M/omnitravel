-- OmniTravel · migración 003 (AWS RDS, base omnitravel_db)
--
-- Fotos de referencia de cada lugar (U04, U06, U08). Son fotos reales con
-- licencia libre (Wikimedia Commons) que se muestran con su autor y licencia;
-- las fotos de evidencia de los reportes siguen en la tabla `evidencia` (S3).
--
-- Aditiva e idempotente: puede ejecutarse varias veces sin efecto adicional.

begin;

create table if not exists public.poi_foto (
  id_foto bigint generated always as identity,
  poi_id bigint not null references public.poi(id_poi) on delete cascade,
  url text not null,
  leyenda text,
  autor text,
  licencia text,
  fuente_url text,
  orden int not null default 0,
  constraint poi_foto_pkey primary key (id_foto),
  constraint poi_foto_poi_url_key unique (poi_id, url)
);

create index if not exists idx_poi_foto_poi on public.poi_foto (poi_id, orden);

commit;
