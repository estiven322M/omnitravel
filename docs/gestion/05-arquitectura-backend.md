# 05. Arquitectura del sistema

## Estilo aprobado (Modelo C4)
Ecosistema con **cliente móvil multirol y backend core separados**. No adoptar microservicios ni arquitecturas exóticas sin una decisión ADR que lo justifique. Las vistas C4 (N1–N4) ya documentadas en `OmniTravel Software Architecture Description – C4 Model.pdf` son la referencia; este documento resume lo operativo de ejecución.

```text
App móvil (React Native + Expo, iOS/Android)
  │  HTTPS/REST + JWT                 │  HTTPS (S3 presigned)          │  SDK de mapas
  ▼                                   ▼                                ▼
Backend NestJS  ──────────────► PostgreSQL + PostGIS (AWS RDS)
  │   │
  │   └──────────────► Valhalla (docker, :8002)  ← ruteo peatonal accesible
  ├────► AWS S3 (evidencia fotográfica)
  └────► Servicio de notificaciones push
Cartografía base: Mapbox / OpenStreetMap (SDK del cliente)
```

## Módulos del backend (NestJS)
```text
src/
├── main.ts / app.module.ts       # bootstrap, configuración global, CORS
├── config/                       # ConfigModule, validación de variables de entorno
├── common/                       # filtros de excepción, interceptores, DTO comunes
│   └── exception/                # formato de error `Error` y códigos estables
├── security/                     # guards JWT, RBAC por rol, decoradores, extracción de identidad
├── auth/                         # registro, login, sesión (JWT propio del backend, bcrypt; ver ADR-09)
├── users/                        # perfiles públicos (sin datos sensibles), roles, estados
├── pois/                         # catálogo POI, búsqueda por bounding box (GeoJSON), detalle
├── accessibility/                # catálogo de características y valores vigentes por POI
├── reports/                      # crowdsourcing: reportes con evidencia, confirmaciones, denuncias
├── moderation/                   # vía B: decisiones del moderador, dashboard, re-verificación, auditoría
├── feedback/                     # retroalimentación post-viaje e incidencias (proceso 3)
├── routes/                       # proxy a Valhalla; reglas de barreras y perfil de ruteo
├── storage/                      # evidencias S3: presigned URLs, validación MIME/tamaño
└── notifications/                # [PENDIENTE: sin contrato aprobado no se implementa]
```
Módulos con `@Module` por dominio; servicio y controlador separados; DTO con `class-validator`; la autorización de pertenencia repite en el servicio lo que el guard decidió por URL.

## Responsabilidades
- Controller: interpretar HTTP, validar el DTO, invocar el servicio y mapear el resultado (nunca devolver entidades crudes).
- Service: caso de uso, reglas de negocio (consenso, estados, barreras), límites transaccionales y autorización por pertenencia.
- Repository/DataSource: persistencia con el ORM del proyecto + SQL espacial selectiva para PostGIS; la SQL queda encapsulada.
- Security: validar JWT, rol y pertenencia; el perfil detallado de accesibilidad jamás fluye por aquí (vive en el dispositivo).
- Storage: la app sube evidencia a S3 con credenciales presignadas de corta duración; el backend valida tipo/tamaño antes de emitirlas y registra los metadatos.

## Persistencia
- PostgreSQL + PostGIS en **AWS RDS** (base `omnitravel_db`, puerto 5432, conexión con SSL). El backend es la única puerta a la BD: la app nunca se conecta directamente. SRID 4326 e índices GIST para todo lo geoespacial (RNF-04). El `postgis/postgis:17-3.5` de `docker-compose.yml` queda solo como opción local de desarrollo.
- ORM del framework con operaciones ordinarias y SQL espacial selectiva encapsulada (índices GIST, `ST_DWithin`, `ST_Intersects`).
- Configuración por variables de entorno desde un archivo `.env` no versionado (`DATABASE_URL` de AWS RDS, `DB_SSL`, `JWT_SECRET`, credenciales de S3, token de push). Nunca credenciales en el repositorio.
- Migraciones SQL aditivas e idempotentes en `backend/sql/` (TypeORM con `synchronize: false`). Los datos del proyecto Supabase anterior se copian con `backend/scripts/copiar-supabase-a-aws.mjs`.
- El backend **no persiste** datos sensibles de discapacidad (RNF-07): el cliente los guarda localmente y envía solo parámetros de restricción anónimos y temporales.

## Motor de ruteo (Valhalla)
- Contenedor ya provisionado (`omnitravel-valhalla`, comando `valhalla_service /data/valhalla.json`, puerto 8002; tiles en `./infra/valhalla/data`).
- Pendiente operativo: generar el grafo con *extracto OSM* del Quindío, activar `costing` peatonal accesible y el mecanismo de exclusión de segmentos con barreras (RNF-21/RNF-26: hoy el backend usa `costing: 'auto'`, notado en `src/services/api/routes.ts`).
- El backend es el único cliente de Valhalla; añade referencia de perfil del usuario como **parámetros anónimos** del payload, nunca datos personales (RNF-07), y maneja los fallos con mensajes claros (RNF-17).

## Transacciones y consistencia
- Confirmación comunitaria (C3): transacción con bloqueo del POI; incremento de `confirmaciones` idempotente y `UNIQUE(poi_id, usuario_id)`; la 3ra confirmación publica exactamente una vez.
- Decisión del moderador (A1): transacción que fija el estado del reporte y del POI de forma coherente, registrando auditoría inmutable (RNF-30).
- Subida de evidencia: reintentos en el dispositivo ante fallos de red ≤ 5 min sin perder evidencia (RNF-19); los metadatos se registran solo tras la confirmación de la subida en S3.

## Observabilidad y configuración
- Configuración única (ConfigModule con `envSchema`), secretos por variables de entorno; Swagger/OpenAPI habilitado en desarrollo y revisado antes del despliegue (exposición pública).
- Logs estructurados con identificadores de correlación; sin contraseñas, tokens, coordenadas persistentes ni datos personales innecesarios.
- Healthcheck: `GET /health` o endpoint equivalente para monitoreo (RNF-16).

## Despliegue
- Local: `docker-compose.yml` (PostGIS + Valhalla) + `npx expo start` para la app.
- App: distribución y OTA updates con EAS (builds en la nube, no requiere Xcode/Android Studio locales); configuración nativa solo vía `app.json` y config plugins (CNG).
- Backend/BD: la BD ya está en AWS RDS; el backend se desplegará en AWS y la evidencia pasará del disco del backend a S3. El pipeline CI/CD queda pendiente de un ADR.
