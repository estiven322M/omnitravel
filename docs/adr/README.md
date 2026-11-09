# Decisiones de arquitectura (ADR)

Fuente única de los ADR de OmniTravel. La numeración ADR-01…ADR-09 es la
misma del documento **C4 Model** (sección 3); ADR-10 y ADR-11 se agregaron en
la entrega final. Unifica los antiguos `docs/gestion/adr/` (otra numeración) y
los cuatro archivos vacíos que había aquí (auditoría 7.3 y 7.4).

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-01](ADR-01-app-movil-multiplataforma.md) | Canal del cliente: aplicación móvil multiplataforma (React Native + Expo) | Aceptada e implementada |
| [ADR-02](ADR-02-backend-api-rest.md) | Backend centralizado como API REST sobre HTTPS/JSON | Aceptada e implementada |
| [ADR-03](ADR-03-backend-nestjs.md) | Tecnología del backend: Node.js con NestJS (TypeScript) | Aceptada e implementada |
| [ADR-04](ADR-04-postgresql-postgis.md) | Persistencia transaccional y geoespacial: PostgreSQL + PostGIS (AWS RDS) | Aceptada e implementada |
| [ADR-05](ADR-05-motor-ruteo-valhalla.md) | Motor de ruteo accesible dedicado: Valhalla | Aceptada e implementada (pgRouting descartado) |
| [ADR-06](ADR-06-mapa-leaflet-osm.md) | Proveedor de mapa base: Leaflet + OpenStreetMap | Aceptada e implementada (Mapbox descartado) |
| [ADR-07](ADR-07-evidencias-s3.md) | Evidencias fotográficas en almacenamiento de objetos (Amazon S3) | Aceptada e implementada |
| [ADR-08](ADR-08-moderacion-hibrida.md) | Moderación híbrida de reportes comunitarios | Aceptada e implementada |
| [ADR-09](ADR-09-datos-sensibles-locales-jwt.md) | Datos sensibles solo en el dispositivo y autenticación JWT | Aceptada e implementada |
| [ADR-10](ADR-10-despliegue-aws.md) | Despliegue en Amazon Web Services con CI/CD | Aceptada e implementada (reemplaza Railway) |
| [ADR-11](ADR-11-acceso-datos.md) | Estrategia de acceso a datos: entidades TypeORM + SQL parametrizado | Aceptada e implementada |
