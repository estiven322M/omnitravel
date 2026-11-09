# ADR-07: Evidencias fotográficas en almacenamiento de objetos (Amazon S3)

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
Las fotos de los reportes no deben guardarse en la base ni en el disco del servidor (se perderían al redesplegar).

## Decisión
Bucket S3 privado `omnitravel-evidencias-<cuenta>`; la base guarda solo la `storage_key`. El backend sube con el rol de la tarea de ECS y entrega cada foto solo con un enlace firmado temporal (HMAC, 1–2 h). Versionado de 30 días.

## Alternativas consideradas
BLOB en PostgreSQL; carpeta del servidor (lo que había en la versión auditada).

## Justificación
Persistencia y escalabilidad; sin claves en el código; fotos no públicas.

## Consecuencias
Validación previa de tipo (firma de bytes) y tamaño (5 MB).

## Evidencia en el repositorio
`backend/src/evidencias/`, `firma-evidencia.ts`, CP-I12.
