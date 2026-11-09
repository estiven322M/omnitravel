-- OmniTravel · datos de catálogo (no son una migración)
--
-- Roles (los 5 que admite el CHECK de `rol`) y las 7 características de
-- accesibilidad del catálogo de producción. Se usan para instalar una base nueva y en las pruebas de
-- integración. Idempotente: no duplica ni cambia filas existentes.

insert into public.rol (id_rol, nombre_rol) overriding system value values
  (1, 'viajero'), (2, 'colaborador'), (3, 'establecimiento'),
  (4, 'moderador'), (5, 'administrador')
on conflict do nothing;

insert into public.caracteristica_accesibilidad (id_caracteristica, nombre, tipo_valor)
  overriding system value values
  (1, 'Tiene rampa', 'booleano'),
  (2, 'Tiene ascensor', 'booleano'),
  (3, 'Tiene baño adaptado', 'booleano'),
  (4, 'Tiene menú Braille', 'booleano'),
  (5, 'Tiene piso podotáctil', 'booleano'),
  (6, 'Tiene semáforo sonoro', 'booleano'),
  (7, 'Ancho de puerta', 'numerico')
on conflict do nothing;

-- Las identidades continúan después de los ids fijos.
select setval(pg_get_serial_sequence('public.rol', 'id_rol'),
              (select max(id_rol) from public.rol));
select setval(pg_get_serial_sequence('public.caracteristica_accesibilidad', 'id_caracteristica'),
              (select max(id_caracteristica) from public.caracteristica_accesibilidad));
