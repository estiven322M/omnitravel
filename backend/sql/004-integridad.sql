-- OmniTravel · migración 004 (AWS RDS, base omnitravel_db)
--
-- Integridad y rendimiento del modelo (auditoría 6.5, NC-04):
--   * Una persona confirma un reporte una sola vez: hoy lo garantiza el
--     servicio (bloqueo `for update`); ahora también la base, con un índice único.
--   * Cada lugar tiene un solo valor por característica de accesibilidad
--     (evita filas repetidas y valores contradictorios).
--   * Índices para las consultas frecuentes del mapa, del Proceso 3 y de la
--     auditoría de cuentas.
--
-- Si ya existieran filas repetidas, el índice único NO se crea y se avisa
-- (para revisarlas a mano), en lugar de fallar o borrar datos.
-- Aditiva e idempotente: puede ejecutarse varias veces sin efecto adicional.

begin;

do $$
begin
  if exists (select 1 from public.confirmacion
              group by reporte_id, usuario_id having count(*) > 1) then
    raise notice 'Hay confirmaciones repetidas: no se crea confirmacion_unica_por_usuario.';
  else
    create unique index if not exists confirmacion_unica_por_usuario
      on public.confirmacion (reporte_id, usuario_id);
  end if;

  if exists (select 1 from public.valor_accesibilidad_poi
              group by poi_id, caracteristica_id having count(*) > 1) then
    raise notice 'Hay valores repetidos por lugar: no se crea valor_unico_por_poi.';
  else
    create unique index if not exists valor_unico_por_poi
      on public.valor_accesibilidad_poi (poi_id, caracteristica_id);
  end if;
end $$;

create index if not exists idx_retroalimentacion_poi on public.retroalimentacion (poi_id);
create index if not exists idx_incidencia_estado     on public.incidencia (estado);
create index if not exists idx_auditoria_usuario     on public.registro_auditoria (usuario_id, fecha desc);
create index if not exists idx_poi_tipo_estado       on public.poi (tipo, estado);

commit;
