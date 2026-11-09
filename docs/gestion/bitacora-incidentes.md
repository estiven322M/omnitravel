# Bitácora de incidentes de operación

Registro de fallas de despliegue y operación (auditoría 6.10 ítem 7). Cada
entrada: qué pasó, impacto, causa, cómo se resolvió y qué se cambió para que
no se repita. Las fallas de CI quedan además en el historial de GitHub Actions.

| # | Fecha | Incidente | Impacto | Causa raíz | Resolución | Prevención |
|---|---|---|---|---|---|---|
| 1 | 2026-11-07 | La preparación de AWS no pudo crear el proveedor OIDC de GitHub | El despliegue automático no podía autenticarse | Política SCP de la organización de AWS que bloquea `iam:CreateOpenIDConnectProvider` | Usuario IAM `omnitravel-github-deploy` de mínimos permisos con claves en GitHub Secrets | `preparar-aws.sh` detecta el bloqueo y usa el usuario IAM; documentado en `docs/DESPLIEGUE.md` |
| 2 | 2026-11-07 | Despliegue fallido: GitHub Actions no encontró las credenciales de AWS | Backend sin publicar en esa ejecución | Secreto con el nombre mal escrito (`AWS_ACCES_KEY_ID`) | Secreto corregido y despliegue relanzado | El flujo verifica que existan los secretos antes de desplegar (`HAY_CLAVES`) |
| 3 | 2026-11-07 | ECS Express Mode rechazó crear el servicio | Backend sin publicar | Faltaba el rol vinculado al servicio de ECS en la cuenta | Rol creado desde CloudShell | `preparar-aws.sh` crea los roles vinculados (PR #32) |
| 4 | 2026-11-08 | La APK respondía «Cannot POST /visitas» | El Proceso 3 no funcionaba en el teléfono | APK compilada desde una copia local desactualizada (versión B sin fusionar) | Versión B respaldada en una rama y fusionada a `main`; APK recompilada | Las APK se compilan solo desde `main` actualizado |
| 5 | 2026-11-08 | La carga de lugares falló («column ubicacion is of type geometry») | Ningún dato cambiado (transacción revertida) | El script convertía a `geography` y la columna es `geometry` | Se quitó la conversión | Esquema real versionado en `backend/sql/000-esquema-base.sql` y pruebas de integración contra PostGIS |
| 6 | 2026-11-08 | Wikimedia respondió HTTP 429 al descargar fotos | Lugares sin foto en esa ejecución | Límite de peticiones del servidor de imágenes | Pausa de 1,5 s y reintentos con espera creciente | Mismo patrón aplicado a Valhalla (`valhalla-cliente.ts`) |

## Cómo registrar un incidente nuevo

1. Agregar una fila con la fecha (hora Colombia) y una descripción breve.
2. Si hubo pérdida de datos, seguir el procedimiento de recuperación de
   `docs/DESPLIEGUE.md` (sección 6) y anotar la hora restaurada.
3. Enlazar el PR que lo corrigió.
