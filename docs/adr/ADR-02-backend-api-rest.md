# ADR-02: Backend centralizado como API REST sobre HTTPS/JSON

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
La app necesita autenticación, mapa, reportes, rutas, retroalimentación y moderación desde un solo servidor.

## Decisión
API REST con JSON sobre HTTPS, documentada con OpenAPI (Swagger solo fuera de producción) y errores con código de dominio (`errorDominio`).

## Alternativas consideradas
GraphQL; gRPC; acceso directo de la app a la base (como en la etapa Supabase).

## Justificación
Interoperable, fácil de probar con Postman/Newman y de proteger con guardas JWT por endpoint.

## Consecuencias
Las rutas no llevan prefijo de versión (`/api/v1`): con un solo cliente propio se decidió no versionar en esta entrega; un cambio incompatible exigiría introducirlo.

## Evidencia en el repositorio
`backend/src/*/*.controller.ts`, colección `postman/`, `docs/gestion/07-contrato-api.md`.
