# 07. Contrato de la API REST

## Fuente y alcance
Este documento describe la propuesta de contrato del backend NestJS de OmniTravel a partir de los requisitos (documento 02), el C4 y el estado actual de la app (hoy consume `POST /routes` y usa mocks tipados para los POI esperando el `MapController`). El archivo `openapi.yaml` de este paquete es el **borrador 0.1.0**; una vez aprobado por el equipo, pasa a ser fuente normativa y ninguna implementación debe divergir de él sin actualizar el archivo.

Servidor local declarado: `http://localhost:3000/api/v1` (puerto NestJS por defecto; ajustar si cambia).

## Convenciones globales
- Autenticación por `Authorization: Bearer <JWT>`, excepto `POST /auth/register`, `POST /auth/login` y (decisión pendiente) la consulta pública del mapa.
- Roles: `VIAJERO_ADI`, `COLABORADOR`, `ESTABLECIMIENTO`, `MODERADOR`, `ADMIN`.
- Geografía: coordenadas `[lat, lon]` decimales WGS-84; el mapa devuelve GeoJSON `FeatureCollection`; *bounding box* en el formato corto `[minLon, minLat, maxLon, maxLat]`.
- Fechas: `YYYY-MM-DD`; timestamps ISO-8601 UTC.
- Calificaciones: enteros 1–5. Montos no aplican (no hay pagos en el alcance).
- Identificadores: UUID.
- HTTP: `200` lectura/actualización; `201` creación; `204` sin cuerpo; `400` solicitud/validación; `401` no autenticado; `403` no autorizado; `404` no encontrado; `409` duplicado/conflicto de estado; `422` regla de negocio; `500` `INTERNAL_ERROR` con mensaje genérico en español que nunca expone trazas ni SQL.
- Estructura de error: `Error { timestamp, status, code, message, details[], path }`; `code` estable y en inglés, `message` en español.
- Rango de advertencias de ruta: `warnings[]` en la respuesta de `/routes` (datos desactualizados > 60 días, verificación pendiente) para RNF-27.
- Perfil del usuario para rutas: solo parámetros de restricción anónimos en el request (`avoidStairs`, `requireElevator`, `preferSoundTrafficLights`); el backend jamás recibe diagnóstico o tipo de discapacidad con nombre (RNF-22).

## Inventario de operaciones (propuesta)

| ID | Método | Ruta | Resumen | Roles | Códigos de error declarados |
|---|---|---|---|---|---|
| U1 | `POST` | `/auth/register` | Registrar cuenta (viajero/colaborador/establecimiento) | PUBLIC | VALIDATION_ERROR, EMAIL_ALREADY_REGISTERED, DATA_POLICY_NOT_ACCEPTED |
| U2 | `POST` | `/auth/login` | Iniciar sesión y obtener JWT | PUBLIC | VALIDATION_ERROR, INVALID_CREDENTIALS, USER_INACTIVE |
| U3 | `POST` | `/auth/logout` | Cerrar sesión (invalidación del lado cliente/servidor) | Authenticated | — |
| U4a | `GET` | `/users/me` | Perfil propio (sin datos sensibles) | Authenticated | NOT_FOUND |
| U4b | `PUT` | `/users/me` | Actualizar perfil básico | Authenticated | VALIDATION_ERROR |
| P1 | `GET` | `/pois` | POI por bounding box con filtros de accesibilidad/categoría (GeoJSON) | Authenticated | VALIDATION_ERROR |
| P3 | `GET` | `/pois/{id}` | Detalle con ficha de accesibilidad y experiencias | Authenticated | NOT_FOUND |
| C1 | `POST` | `/pois` | Crear POI con reporte inicial (estado PENDIENTE_VALIDACION) | Authenticated | VALIDATION_ERROR, DUPLICATE_POI, FILE_REJECTED |
| C2 | `POST` | `/pois/{id}/reports` | Reportar actualización/accesibilidad con evidencia | Authenticated | VALIDATION_ERROR, NOT_FOUND, FILE_REJECTED |
| C3 | `POST` | `/pois/{id}/confirmations` | Confirmar accesibilidad (consenso) | Authenticated | NOT_FOUND, DUPLICATE_CONFIRMATION, SELF_CONFIRMATION, ALREADY_PUBLISHED |
| C4 | `POST` | `/reports/{id}/denuncias` | Denunciar reporte por falsedad/spam | Authenticated | NOT_FOUND, VALIDATION_ERROR |
| C2b | `POST` | `/evidences/presign` | URL presignada S3 para evidencia (valida MIME/tamaño) | Authenticated | VALIDATION_ERROR, FILE_REJECTED |
| RT1 | `POST` | `/routes` | Calcular ruta peatonal accesible (proxy Valhalla) | Authenticated | VALIDATION_ERROR, ROUTE_ENGINE_ERROR, BARRIER_BLOCKED |
| F1/F2 | `POST` | `/experiences` | Registrar retroalimentación post-viaje | Authenticated | VALIDATION_ERROR, NOT_FOUND, ALREADY_REVIEWED, TOO_EARLY |
| F3 | `POST` | `/incidents` | Reportar discrepancia → re-verificación trazable | Authenticated | NOT_FOUND, VALIDATION_ERROR |
| F4 | `GET` | `/pois/{id}/experiences` | Experiencias del POI | Authenticated | NOT_FOUND |
| A2 | `GET` | `/moderation/dashboard` | Métricas e incidencias (M02) | MODERADOR, ADMIN | ACCESS_DENIED |
| A3 | `GET` | `/moderation/reports` | Listado de reportes con filtros (M03) | MODERADOR, ADMIN | ACCESS_DENIED |
| A4 | `GET` | `/moderation/reports/{id}` | Detalle para moderar (M04) | MODERADOR, ADMIN | ACCESS_DENIED, NOT_FOUND |
| A4b | `POST` | `/moderation/reports/{id}/decision` | Aprobar/rechazar/solicitar revisión (M05) | MODERADOR, ADMIN | ACCESS_DENIED, NOT_FOUND, REPORT_ALREADY_RESOLVED, VALIDATION_ERROR |
| A5 | `GET` | `/moderation/denuncias` | Atención de denuncias | MODERADOR, ADMIN | ACCESS_DENIED |
| A6 | `GET` | `/moderation/incidents` | Gestión de incidencias (M06) | MODERADOR, ADMIN | ACCESS_DENIED |
| A6b | `PATCH` | `/moderation/incidents/{id}` | Resolver/escalar incidencia | MODERADOR, ADMIN | ACCESS_DENIED, NOT_FOUND, INVALID_STATE |
| A8 | `GET` | `/moderation/audit` | Consulta de auditoría de moderación | ADMIN | ACCESS_DENIED |
| N1 | — | `/notifications` | [PENDIENTE: sin contrato aprobado no se declara] | — | — |

## Esquemas reutilizables (resumen)
- `Error`, `ErrorDetail {field, message}` y `PageMetadata {page, size, totalElements, totalPages}` — misma estructura general que el contrato de referencia del curso.
- `Caracteristica { id, nombre, tipoValor (BOOLEANO|NUMERICO|TEXTO), unidad?, icono }` — espejo del catálogo CARACTERISTICA_ACCESIBILIDAD.
- `ValorAccesibilidad { caracteristicaId, valorBooleano?, valorNumerico?, valorTexto? }` — forma exacta ya consumida por la app (`mobile-app/src/services/types.ts`), que debe mantenerse al exponer los endpoints reales.
- `PoiGeoFeature { Feature con geometry Point y properties: id, nombre, categoria, estadoVerificacion, confirmaciones, calificacion }` para `GET /pois`.
- `Poi { id, nombre, categoria, descripcion, direccion, ciudad, latitud, longitud, calificacion, totalExperiencias, confirmaciones, estadoVerificacion (PENDIENTE|EN_REVISION|VERIFICADO), ultimaVerificacion, valores[], experiencias[] }` — espejo del tipo `Poi` de la app.
- `RouteRequest { origin [lat,lon], destination [lat,lon], restrictions? { avoidStairs?, requireElevator?, preferSoundTrafficLights?, ... } }`
- `RespuestaRuta` compatible con Valhalla (`trip.summary.length/time`, `trip.legs[].shape` polyline con precisión 6) más `warnings[]`; `ResultadoRuta { distanciaKm, duracionMin, coordenadas[]? }` en la app.
- `DecisionModeracionRequest { accion (APROBADO|RECHAZADO|REVERIFICAR), motivo }`.
- `IncidentRequest { poiId, origenExperienciaId?, tipo, descripcion }`.

## Observaciones del contrato
- El `openapi.yaml` acá incluido es un borrador con `x-status: BORRADOR`; no generar código cliente definitivo hasta su aprobación.
- La app ya define la forma de `Poi`, `ValorAccesibilidad` y `ResultadoRuta`; exponer los endpoints reales con esa misma forma para reemplazar los mocks sin romper el front.
- El endpoint `/routes` debe migrar de `costing: 'auto'` a peatonal accesible; el contrato devuelve además `warnings` para RNF-27 y `BARRIER_BLOCKED` cuando no existe ruta sin barreras críticas (RNF-26/RNF-26).
- No renumerar IDs si la matriz oficial de requisitos del curso introduce otros; documentar el mapeo.
