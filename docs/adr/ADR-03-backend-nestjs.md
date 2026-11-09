# ADR-03: Tecnología del backend: Node.js con NestJS (TypeScript)

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
Se necesita E/S asíncrona (base, Valhalla, S3) y una arquitectura modular mantenible por un equipo pequeño.

## Decisión
NestJS 12 con TypeScript, un módulo por dominio (auth, mapa, reportes, routing, feedback, moderacion, evidencias, favoritos).

## Alternativas consideradas
Express sin framework; Java Spring Boot; Django; .NET.

## Justificación
Inyección de dependencias, guardas y pipes estándar; mismo lenguaje que la app (TypeScript).

## Consecuencias
El documento C4 mencionaba «Express (o Spring Boot)» en el N2: se corrige a NestJS. El módulo `reports` (solo lectura) se unificó en `reportes` (auditoría 6.4 ítem 8).

## Evidencia en el repositorio
`backend/src/app.module.ts`, `backend/package.json`.
