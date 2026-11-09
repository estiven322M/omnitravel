# ADR-08: Moderación híbrida de reportes comunitarios

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
Información falsa en el mapa pone en riesgo físico a las personas con discapacidad.

## Decisión
Vía A: el reporte se publica solo con 3 confirmaciones de otras personas (nunca la propia). Vía B: un moderador aprueba o rechaza con motivo. Toda decisión queda en `moderacion` y `registro_auditoria`.

## Alternativas consideradas
Publicar sin filtro; solo moderación manual.

## Justificación
Escala con la comunidad sin perder control de calidad.

## Consecuencias
Estados intermedios (`pendiente_validacion`, `en_revision`) y re-verificación cuando el Proceso 3 detecta discrepancias.

## Evidencia en el repositorio
`backend/src/reportes/reportes.service.ts`, CP-F105–CP-F109, CP-I06–CP-I09.
