# 10. Plan de implementación incremental

El orden busca construir primero las capacidades de las que dependen los módulos de negocio. Cada cierre de fase debe dejar compilación, `typecheck`/`lint`, pruebas y documentación actualizada. Se desarrolla por historias de usuario, una rama por HU.

## Fase 0 — Preparación y acuerdos (en curso)
- Aprobar la propuesta de documentación (los de esta carpeta `docs/gestion/`), en particular el `openapi.yaml` y el esquema propio de OmniTravel frente al proyecto Supabase compartido.
- ✅ Acceso decidido: backend NestJS como única puerta de la BD en AWS RDS (acceso directo Supabase retirado de la app).
- Confirmar imagen de PostGIS (ya definida: `postgis/postgis:17-3.5`) y acordar herramienta de migraciones cuando el esquema se estabilice.
- Definir los tamaños de carga de evidencia y el catálogo inicial de características con el equipo.

## Fase 1 — Esqueleto del backend y modelo de datos
- Módulos NestJS `auth`, `users`, `pois`, `accessibility` con `ConfigModule` validado, formato `Error` global y Swagger.
- Esquema físico de OmniTravel (documento 04) sobre el PostGIS de `docker-compose`.
- ✅ Endpoints de autenticación con cuentas propias (bcrypt + JWT) sobre la tabla `usuario` en AWS RDS.
- Pruebas: contrato del formato `Error`, tokens ausente/inválido/expirado, roles.

## Fase 2 — POI y mapa (reemplazo de mocks)
- `MapController`: `GET /pois` por bounding box → GeoJSON y `GET /pois/{id}` con la misma forma de los mocks (`Poi`, `ValorAccesibilidad`, estado `PENDIENTE|EN_REVISION|VERIFICADO`).
- Catálogo de características servido desde la BD (hoy duplicado en `mocks/catalog.ts`).
- La app consume el backend real manteniendo los tipos; mocks permanecen solo para pruebas y desarrollo sin red.
- Pruebas: filtros combinados, GeoJSON válido, índices GIST usados en los planes de ejecución.

## Fase 3 — Crowdsourcing (Proceso 1, vía A)
- Creación de POI/reportes con evidencia: `POST /evidences/presign` (validación MIME/tamaño) y reintentos en el dispositivo (RNF-09).
- Confirmaciones con consenso transaccional (3 independientes, anti-autoconfirmación) (RNF-22/07/28) y pantalla S01.
- Denuncias (C4) alimentando la cola de moderación.
- Pruebas de concurrencia en confirmaciones.

## Fase 4 — Moderación (Proceso 1, vía B; M01–M07)
- Módulo `moderation`: dashboard (M02), lista/detalle de reportes (M03/M04), decisión (M05) con auditoría inmutable (RNF-30), atención de denuncias, resolución de re-verificaciones (M06) y estadísticas (M07).
- Login corporativo `@omnitravel.edu.co` con RBAC exclusivo (RNF-23); estado visible ≤ 2 s (RNF-03).

## Fase 5 — Rutas accesibles (Proceso 2)
- Migrar `POST /routes` de `costing: 'auto'` a peatonal accesible; construir el grafo Valhalla con extracto OSM de la región objetivo (Quindío) y mecanismo de exclusión de barreras (RNF-26/26).
- Advertencias por datos desactualizados (`warnings[]`, RNF-27) y manejo de fallo con mensaje claro (RNF-09).
- Alerta S02 y recálculo dinámico en navegación.
- Medición RNF-01 (≤ 3 s, 95%, 200 usuarios) como criterio de cierre.

## Fase 6 — Retroalimentación e incidencias (Proceso 3)
- Experiencias post-viaje (F1/F2) solo tras finalización confirmada (RNF-19) y agregado a la ficha del POI.
- Detección de discrepancia y solicitud de re-verificación trazable (RNF-19) con pasaje del POI a EN_REVISION (RNF-05).
- Notificación interna al módulo de moderación (sin catálogo push todavía).

## Fase 7 — Notificaciones push (cuando el contrato se apruebe)
- Definir catálogo de eventos (estado de reportes, alertas de ruta), persistencia y reintentos.
- Integración con servicio de push; sin datos sensibles en payload.

## Fase 8 — No funcionales y accesibilidad
- Medir RNF-04 (carga de mapa ≤ 2 s en 4G), RNF-28 (subida ≤ 5 s), RNF-13 (reporte ≤ 2 min) en dispositivo real.
- Auditoría WCAG 2.1 AA (RNF-11) y TalkBack/VoiceOver (RNF-12) por pantalla; cerrar hallazgos de `triple-rn-a11y`.
- Verificar RNF-22 (cifrado AES-256 del perfil local), RNF-24 (HTTPS en todo) y RNF-30 (auditoría).

## Fase 9 — Despliegue y operación
- Builds y OTA con EAS para la app; entorno cloud para backend+BD (decisión por ADR).
- Monitoreo de disponibilidad (RNF-06) y logging sin PII; secretos fuera del repo.
- Revisión final de seguridad: security group de AWS RDS (solo el backend accede a la BD), CORS, exposición de Swagger.
