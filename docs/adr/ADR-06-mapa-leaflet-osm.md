# ADR-06: Proveedor de mapa base: Leaflet + OpenStreetMap

- **Estado:** Aceptada e implementada (Mapbox descartado)
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
La app debe mostrar el mapa con lugares, barreras y la ruta, sin almacenar cartografía.

## Decisión
Leaflet 1.9 con teselas de OpenStreetMap, dentro de un WebView (teléfono) o iframe (web), con un protocolo de mensajes propio.

## Alternativas consideradas
Mapbox (requiere API key y cuenta de facturación); Google Maps SDK.

## Justificación
Sin llaves ni costos, el mismo mapa en Android y web, y datos de OSM coherentes con Valhalla.

## Consecuencias
Atribución obligatoria a OpenStreetMap. Las etiquetas se muestran por prioridad para que no se superpongan (auditoría 6.8 ítem 4).

## Evidencia en el repositorio
`mobile-app/src/components/mapaLeaflet.ts`.
