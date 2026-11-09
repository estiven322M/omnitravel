# ADR-11: Estrategia de acceso a datos: entidades TypeORM + SQL parametrizado

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
La auditoría (6.4 ítem 8) observó que se mezclan TypeORM y SQL directo.

## Decisión
Una sola conexión (el `DataSource` de TypeORM). Entidades TypeORM solo para cuentas (`usuario`, `rol`); el resto con SQL parametrizado (`$1…`) a través del mismo `DataSource`, porque usa PostGIS, CTE y bloqueos `for update` que el ORM no expresa bien. `synchronize: false`: el esquema solo cambia con migraciones versionadas.

## Alternativas consideradas
Todo con entidades TypeORM; un query builder (Knex).

## Justificación
Consultas geoespaciales y transaccionales explícitas y revisables, sin perder el pool, el TLS ni las transacciones comunes.

## Consecuencias
Toda consulta va parametrizada (sin concatenar entradas). Las pruebas de integración ejecutan cada consulta contra PostGIS real.

## Evidencia en el repositorio
`backend/src/app.module.ts`, `backend/src/*/*.service.ts`, `backend/sql/`.
