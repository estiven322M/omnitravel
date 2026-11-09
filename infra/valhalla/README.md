# Valhalla local (opcional, solo desarrollo)

En producción el backend usa el servidor de Valhalla definido en `VALHALLA_URL`
(con tiempo límite, reintentos y mensaje de contingencia: `backend/src/routing/valhalla-cliente.ts`).
Este directorio sirve para levantar un Valhalla propio con `docker-compose.yml`
cuando se quiere trabajar sin depender del servidor público (riesgo 4 de la auditoría).

Las **teselas** (`data/valhalla/**/*.gph`, cientos de MB) son datos generados y
**no se versionan** (`.gitignore`); solo se versiona `data/valhalla.json`.

## Generar las teselas de Armenia, Quindío

```bash
# 1. Extracto de OpenStreetMap de Colombia (Geofabrik)
mkdir -p infra/valhalla/data && cd infra/valhalla/data
curl -LO https://download.geofabrik.de/south-america/colombia-latest.osm.pbf

# 2. Construir las teselas con la misma imagen que usa docker-compose
docker run --rm -v "$PWD":/data ghcr.io/valhalla/valhalla:latest \
  valhalla_build_tiles -c /data/valhalla.json /data/colombia-latest.osm.pbf

# 3. Levantar el servicio (desde la raíz del repositorio)
cd ../../.. && docker compose up -d valhalla
# Backend: VALHALLA_URL=http://localhost:8002
```
