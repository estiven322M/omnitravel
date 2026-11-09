# ADR-05: Motor de ruteo accesible dedicado: Valhalla

- **Estado:** Aceptada e implementada (pgRouting descartado)
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
Las rutas para personas con movilidad reducida deben evitar escaleras y barreras; un ORM no resuelve ruteo.

## Decisión
El backend traduce el perfil del usuario a una solicitud peatonal de Valhalla (`costing: pedestrian`, `type: wheelchair`, penalización de escalones) y normaliza la respuesta. «Cambiar ruta» usa `exclude_locations`.

## Alternativas consideradas
pgRouting sobre la misma base; Google Directions; algoritmo propio.

## Justificación
Valhalla trae el perfil peatonal/silla de ruedas listo y datos de OpenStreetMap. pgRouting exigiría cargar y mantener el grafo vial en RDS: se descartó (la extensión existe en RDS pero no se usa).

## Consecuencias
Dependencia del servidor público de Valhalla: mitigada con tiempo límite de 12 s, 3 intentos y 503 de contingencia; `infra/valhalla/README.md` explica cómo levantar uno propio.

## Evidencia en el repositorio
`backend/src/routing/valhalla-payload.ts`, `valhalla-cliente.ts`, CP-I14–CP-I16.
