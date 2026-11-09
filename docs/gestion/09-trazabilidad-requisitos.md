# 09. Matriz de trazabilidad

Esta matriz vincula los requisitos funcionales propuestos (documento 02) con las pantallas del mockup, los componentes y las pruebas mínimas. Debe ampliarse con los IDs oficiales de requisitos del curso cuando exista una matriz aprobada, y con las HU efectivamente construidas.

| IDs | Dominio | Pantallas (mockup) | Componentes principales | Pruebas mínimas |
|---|---|---|---|---|
| U1–U4 | Usuarios y perfiles | U01–U03, U12 | `auth` (backend NestJS, JWT propio), guardas JWT, `profileStore` local cifrado | Registro con política aceptada, login válido/inválido, sesión ≤ 24 h y cifrada (RNF-25), campos sensibles fuera del backend (RNF-22) |
| U5–U6 | Notificaciones y gamificación | U11, U12 | Notificaciones derivadas de reportes y barreras; «Mis reportes» con el estado de cada aporte | Pruebas de la app (`moderacion.test.ts`, `reportes.test.ts`) |
| P1–P5 | POI y mapa | U04–U08 | `mapa` (GET /mapa con GeoJSON de PostGIS), catálogo de características, mapa Leaflet + OpenStreetMap | Bounding box válido, GeoJSON correcto, filtros combinados, formas idénticas a los mocks (`Poi`, `ValorAccesibilidad`) |
| C1–C6 | Crowdsourcing | U09–U10, S01 | `reportes` (reportes, confirmaciones), `evidencias` (S3 con enlace firmado) | Consenso de 3 publicado exactamente una vez (RNF-22/07), anti-autoconfirmación (RNF-29), MIME/tamaño (RNF-28), reintentos de evidencia (RNF-09), EN_REVISION tras re-verificación (RNF-05) |
| RT1–RT5 | Rutas accesibles | U06–U07, S02 | `routing` (Valhalla peatonal + silla de ruedas, reintentos), `polyline.ts`, `cambioRuta.ts` | Exclusión de barreras críticas (RNF-26/26), warnings > 60 días (RNF-27), fallo con mensaje claro (RNF-09), ≤ 3 s en 95% (RNF-01) |
| F1–F4 | Retroalimentación | U08, Feedback | `feedback` (visitas, experiencias, incidencias), `moderacion` (re-verificación) | Solo post-viaje (RNF-19), discrepancia genera re-verificación trazable (RNF-19) |
| A1–A8 | Moderación/admin | M01–M07 | `moderacion` (tablero, incidencias, estadísticas), `reportes` (decisiones), `registro_auditoria`, RBAC | Solo MODERADOR/ADMIN (RNF-23), decisión sobre-escribe consenso (RNF-20), sin segunda decisión (409), auditoría inmutable (RNF-30), estado visible ≤ 2 s (RNF-03) |

## Estado actual del proyecto (actualizado 8 nov 2026, versión final)

| Elemento | Estado | Evidencia |
|---|---|---|
| Autenticación y roles (U01–U03, M01) | ✅ Implementado: JWT de 24 h, bcrypt, límite de intentos, rol verificado en el servidor y auditoría de inicios de sesión y cambios de rol | `backend/src/auth`, pruebas `auth.service.spec.ts`, CP-I04/CP-I05 |
| Mapa con lugares reales (U04–U08) | ✅ `GET /mapa` desde AWS RDS (39 lugares reales de Armenia en 5 categorías); la app ya no usa mocks de lugares | `backend/src/mapa`, CP-I10 |
| Proceso 1 — reportes y consenso (U09–U10, M03–M05) | ✅ Consenso de 3 confirmaciones, anti-autoconfirmación, evidencia en S3 con enlace firmado y vía del moderador | `backend/src/reportes`, CP-U01…, CP-F101–CP-F109, CP-I06–CP-I13 |
| Proceso 2 — rutas accesibles (U06–U07) | ✅ `POST /routes` con `costing: 'pedestrian'` y perfil `wheelchair` (no `auto`), filtros obligatorios, «Cambiar ruta» con `exclude_locations`, tiempo límite y reintentos | `backend/src/routing`, CP-F201–CP-F206, CP-I14–CP-I16 |
| Proceso 3 — visitas y retroalimentación (U08, M06) | ✅ Visita → experiencia → incidencia → re-verificación → publicación | `backend/src/feedback`, `moderacion`, CP-F301–CP-F319, CP-I17–CP-I20 |
| Moderación (M02–M07) | ✅ Tablero, reportes, incidencias y estadísticas | `backend/src/moderacion` |
| Notificaciones (U11) | ✅ Derivadas de los datos del usuario (estado de sus reportes, barreras cercanas); sin push | `mobile-app/src/screens/NotificacionesScreen.tsx` |
| Denuncias de reportes (C4) | ❌ Fuera del alcance de la entrega final | — |
| Despliegue | ✅ AWS: ECS Express (API), Amplify (web), RDS (BD), S3 (fotos); CI/CD en GitHub Actions | `docs/DESPLIEGUE.md` |

Pruebas automatizadas: unitarias (Jest backend y app), integración (API +
PostGIS real, 20 casos), funcionales (Postman/Newman, 36 casos) y
accesibilidad (axe-core WCAG 2.1 AA, 11 pantallas). Todas corren en GitHub
Actions; los casos están cargados en TestRail (`testrail/`).

## Requisitos no funcionales
Relacionar cada prueba con los RNF del documento 03; ninguna métrica se da por cumplida sin evidencia reproducible (comando, entorno y resultados).

## Criterio de cierre
No marcar una fila como cumplida hasta que existan: código, prueba automatizada (o medición reproducible) y evidencia guardada. Las decisiones pendientes (contrato de notificaciones, perfil de ruteo de Valhalla) se registran en el documento 01 y bloquean los IDs asociados.
