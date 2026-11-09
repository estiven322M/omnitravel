# 08. Estrategia de pruebas del sistema

## Pirámide
1. **Unitarias** de reglas de negocio y servicios (backend NestJS con Jest; app móvil con Jest + `@testing-library/react-native`).
2. **De slice** para controladores, validación de DTO y repositorios cuando aporten valor.
3. **De integración/contrato** de endpoints contra PostgreSQL+PostGIS real (Testcontainers o base efímera) y validación del `openapi.yaml` cuando se apruebe.
4. **E2E de la app** para flujos U01–U12, M01–M07, S01/S02 (del Unit actual a instrumentación tipo Detox cuando el equipo lo apruebe).
5. **De rendimiento y carga** para los RNF medibles (RNF-01, RNF-04, RNF-02).
6. **De accesibilidad** (RNF-11, RNF-12) y de seguridad funcional (RNF-29).

## Herramientas (estado del repo)
- App: `jest-expo` + `@testing-library/react-native` (ya configurados en `mobile-app`); pruebas actuales de `profileStore`, `format`, `filters` y `AccessibilityValueRow`.
- Análisis estático de accesibilidad: `eslint-plugin-triple-rn-a11y` (ya en `devDependencies`) como primer filtro de RNF-11/RNF-12.
- Backend: Jest + Supertest; Testcontainers con imagen `postgis/postgis:17-3.5` para pruebas con contexto completo (requiere Docker en ejecución). Confirmar ORM antes de fijar utilidades.
- Carga: k6 o JMeter para la API (100–200 usuarios concurrentes en `/routes` y consultas PostGIS).
- `npx tsc --noEmit` y `npx expo lint` deben pasar antes de declarar cualquier tarea de app como terminada (regla del `AGENTS.md` local).

## Casos transversales
- Validación de DTO y errores de entrada (400 con `code`/`message` correctos).
- Respuesta HTTP y estructura `Error` en todos los códigos documentados.
- Autenticación: token ausente/inválido/expirado (401) y rol insuficiente (403) en endpoints protegidos.
- Paginación y límites de los listados (/moderation/reports, /pois/{id}/experiences).
- Coordenadas fuera de rango, bounding box invertido y GeoJSON válido.
- Idempotencia ante solicitudes repetidas con llave de idempotencia válida.

## Casos de negocio prioritarios
### Consenso comunitario (Proceso 1)
- La 3ra confirmación independiente publica el POI exactamente una vez; dos confirmaciones simultáneas no publican dos veces (RNF-07).
- El creador del reporte no puede confirmar su propio reporte (RNF-29) ni un usuario confirmar dos veces el mismo POI.
- Un reporte rechazado por el moderador no puede pasar a PUBLICADO por consenso posterior.
- Una denuncia activa la revisión de la vía B; la decisión del moderador sobreescribe el estado previo (A1).

### Evidencias y S3
- Archivo con MIME/tamaño fuera de la política: rechazo antes de emitir URL presignada (RNF-28).
- Fallo de red ≤ 5 min durante la subida: el archivo pendiente no se pierde y se reintenta (RNF-09).

### Rutas accesibles (Proceso 2)
- Rutas generadas excluyen segmentos marcados como barrera crítica para el perfil solicitado (RNF-26) con casos de prueba funcionales.
- 0% de rutas con barrera crítica entregadas (RNF-26).
- Tramos con datos > 60 días generan `warnings` (RNF-27) y el fallo del motor devuelve mensaje claro (RNF-09).
- Rendimiento: `POST /routes` ≤ 3 s en el 95% de solicitudes con 200 usuarios concurrentes (RNF-01).

### Moderación (Proceso 1 vía B, M01–M07)
- Solo MODERADOR/ADMIN acceden al módulo (RNF-23); el resto recibe 403.
- Cada decisión crea registro de auditoría inmutable con responsable y fecha (RNF-30).
- Un reporte ya cerrado no acepta segunda decisión (409 `REPORT_ALREADY_RESOLVED`).

### Retroalimentación (Proceso 3)
- No se solicita retroalimentación ante trayecto/visita no finalizado (RNF-19).
- Discrepancia registrada genera solicitud de re-verificación trazable (RNF-19) y el POI pasa a EN_REVISION en <1 min (RNF-05).

## Pruebas no funcionales medibles
- RNF-02: 300 consultas espaciales concurrentes sobre PostGIS con tiempo de referencia del RNF-01; verificar uso de índices GIST en los planes de ejecución.
- RNF-06: disponibilidad medida en producción/entorno ≥ 99% mensual (monitoreo, no pruebas unitarias).
- RNF-11/RNF-12: auditoría con herramienta (p. ej. Accessibility Inspector / Lighthouse móvil / manual con TalkBack y VoiceOver) de los componentes de navegación principal y pantallas clave.
- RNF-13/RNF-13: pruebas con usuarios o cronometraje del flujo en el dispositivo.

## Trazabilidad y evidencia
Cada prueba importante se relaciona con ID de requisito (documento 02), RNF aplicable y pantalla del mockup. Registrar comando, entorno, resultado y limitaciones. No declarar que una métrica cumple sin una medición reproducible (ver matriz del documento 09).
