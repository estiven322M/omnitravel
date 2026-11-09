# ADR-04: Persistencia transaccional y geoespacial: PostgreSQL + PostGIS (AWS RDS)

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
Usuarios, reportes y, sobre todo, ubicaciones de lugares y barreras.

## Decisión
PostgreSQL con PostGIS en Amazon RDS (`omnitravel_db`); `poi.ubicacion` es `geometry(Point, 4326)` con índice GiST; migraciones versionadas en `backend/sql/000…NNN`.

## Alternativas consideradas
MySQL; MongoDB; MariaDB.

## Justificación
Consultas espaciales nativas (GeoJSON, distancias) e integridad referencial.

## Consecuencias
Respaldos automáticos con restauración a un minuto (7 días), instantánea manual y prueba de restauración (`infra/aws/respaldos.sh`). Modelo en `docs/gestion/04`.

## Evidencia en el repositorio
`backend/sql/`, `docs/modelo-datos/mer.png`, pruebas de integración.
