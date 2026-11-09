# 12. Runbook de despliegue — Entrega 2

> Objetivo: dejar la app instalable y los servicios operables para la evaluación de los Procesos 1 y 2, con el mínimo de fricción en la ventana de 48 h.

## 0. Qué se despliega y dónde

| Pieza | Dónde | Estado hoy | Cómo |
|---|---|---|---|
| App móvil (APK Android) | **EAS Build** (nube de Expo) | `eas.json` listo (`preview` → APK) | `npm run build:apk` en `mobile-app/` |
| Backend NestJS | Nube (Render/Railway) o **LAN** | Dockerfile listo en `backend/` | ver §2 |
| Motor Valhalla | **LAN** (Docker) — o VPS si se consigue | Grafo **ya construido** en `infra/valhalla/data/valhalla/` | `docker compose up -d valhalla` |
| BD (PostgreSQL + PostGIS) | **AWS RDS** (`omnitravel_db`) | Operativa; Auth y Proceso 1 en el backend | `DATABASE_URL` en `backend/.env`; datos copiados con `backend/scripts/copiar-supabase-a-aws.mjs` |

Decisión de ventana: el APK (nube) es el **link de la aplicación desplegada**; Valhalla y el backend pueden quedar en LAN para la demo + video de evidencia. Si el backend queda en LAN, el APK que se reparta debe construirse con la **IP LAN** en `EXPO_PUBLIC_API_URL` (ver §3) — o construirse un APK "demo" con la URL LAN del día de la grabación.

## 1. App móvil — build de APK con EAS (recomendado)

Requisitos: cuenta en [expo.dev](https://expo.dev) (gratuita) y estar en `mobile-app/`.

```powershell
cd mobile-app

# 1) Iniciar sesión (abre navegador)
npx.cmd eas-cli@latest login

# 2) Vincular el proyecto al owner de Expo (agrega extra.eas.projectId en app.json)
npx.cmd eas-cli@latest init

# 3) Configurar las variables de entorno del perfil preview (una sola vez)
npx.cmd eas-cli@latest env:create --environment preview --visibility plaintext `
  --name EXPO_PUBLIC_API_URL --value "http://<IP-LAN-del-backend>:3000"

# 4) Construir el APK (perfil preview)
npm.cmd run build:apk
```

Al terminar, EAS entrega dos cosas para la entrega de la plataforma:

1. **Link del build** (`https://expo.dev/accounts/<cuenta>/projects/omnitravel/builds/<id>`) — desde ahí se descarga el APK. Es el "link de la aplicación desplegada".
2. Página del proyecto para instalar el APK en el teléfono de demostración.

> Nota `development`: el perfil `development` usa `expo-dev-client`; si nadie lo va a usar, no instalar nada — el perfil `preview` no lo requiere.

### Fallback si EAS falla o no hay cuenta

- `npx.cmd expo start --tunnel` + Expo Go (QR) para la demo en vivo (requiere internet).
- Video de la demo completa como evidencia (patrón ya usado en `docs/video prueba Expo Go.mp4`).
- Documentar la limitación en la entrega.

## 2. Backend NestJS

### Opción A — LAN (recomendada para el día de la demo)

```powershell
# 1) Infra local (PostGIS + Valhalla ya construido)
docker compose up -d

# 2) Backend
cd backend
npm.cmd install
npm.cmd run start:dev        # escucha en 0.0.0.0:3000

# 3) IP LAN del equipo (la que va en EXPO_PUBLIC_API_URL)
ipconfig | Select-String "IPv4"
```

### Opción B — Nube (para que el link funcione fuera de la red)

El `backend/Dockerfile` está listo para cualquier host con Docker (Render, Railway, Fly.io):

- Variables: `PORT` (según host) y `VALHALLA_URL` (URL del motor, §3).
- El host debe poder alcanzar a Valhalla: en prácticas de curso es habitual desplegar ambos contenedores en un mismo VPS pequeño, o dejar Valhalla en LAN y aceptar que el ruteo solo funcione en la red local de la demo.

## 3. Valhalla (motor de ruteo)

El grafo de la región **ya está construido** en `infra/valhalla/data/valhalla/` (no se versiona por peso). Para levantarlo:

```powershell
docker compose up -d valhalla     # http://localhost:8002
```

Reconstrucción (si se necesita en otra máquina o VPS):

```powershell
# Extracto OSM (ejemplo Colombia de Geofabrik) dentro de infra/valhalla/data/
curl.exe -L -o infra/valhalla/data/colombia-latest.osm.pbf https://download.geofabrik.de/south-america/colombia-latest.osm.pbf

# Construir tiles (usa valhalla.json existente)
docker run --rm -v "${PWD}/infra/valhalla/data:/data" ghcr.io/valhalla/valhalla:latest `
  valhalla_build_tiles -c /data/valhalla.json /data/colombia-latest.osm.pbf
```

El backend ya implementa el perfil peatonal accesible (2026-10-18): `costing: 'pedestrian'` con `costing_options` derivadas de `restrictions` (motriz → `type: 'wheelchair'` + penalización de escaleras y ascensores favorecidos; visual → `type: 'blind'`), instrucciones en `es-ES` y respuesta normalizada con `pasos[]` y `advertencias[]` — detalle en `backend/src/routing/valhalla-payload.ts` (con pruebas).

Smoke test del motor (requiere Valhalla arriba y el backend corriendo):

```powershell
curl.exe -s http://localhost:3000/routes -H "Content-Type: application/json" -d '{\"origin\":[4.537,-75.675],\"destination\":[4.53389,-75.68111],\"restrictions\":{\"perfil\":\"silla_de_ruedas\",\"avoidStairs\":true,\"requireElevator\":true}}'
```

Respuesta esperada: `distanciaKm`, `duracionMin`, `perfil`, `shape`, `pasos[]` y `advertencias[]`.

## 4. Credenciales de acceso para la entrega

1. Registrar **4 cuentas** desde la app (U03): 3 viajeros + 1 que será moderador.
2. Promover la cuenta moderadora (cliente SQL conectado a AWS RDS, base `omnitravel_db`):

```sql
update public.usuario set rol_id = 4 where email = 'moderador.demo@omnitravel.test';
```

3. Adjuntar en la entrega la tabla de credenciales:

| Rol | Correo | Contraseña | Uso |
|---|---|---|---|
| Viajero 1 | (registrar) | (definir) | Reportar, confirmar |
| Viajero 2 | (registrar) | (definir) | Confirmar consenso |
| Viajero 3 | (registrar) | (definir) | Confirmar consenso |
| Moderador | moderador.demo@… | (definir) | Consola M03–M05 |

> El autor de un reporte no puede confirmar su propio reporte (RNF-29): repartir los 3 votos del consenso entre cuentas distintas a la autora del reporte.

## 5. Verificación post-despliegue (día de la entrega)

- [ ] APK instala en un teléfono limpio (**sin** Expo Go) y abre la app.
- [ ] Login con las 4 cuentas demo (y cierre de sesión).
- [ ] Mapa U06 carga POIs y la ruta se calcula contra el backend desplegado.
- [ ] Proceso 1: crear reporte con foto → aparece en `PENDIENTE_VALIDACION`.
- [ ] Proceso 1: 3 confirmaciones de cuentas distintas → POI publicado + modal S01.
- [ ] Proceso 1: moderador ve el reporte (M03/M04) y rechaza con motivo (M05).
- [ ] Proceso 2: ruta con restricciones del perfil (P2-01/02), navegación U07 con pasos y advertencia de datos > 60 días (P2-03/05), S02 con recálculo (P2-04) y fallo del motor con mensaje claro (P2-06).
- [ ] Video de demo grabado con las dos cuentas clave (viajero + moderador).

## 6. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| EAS en cola > 40 min | Lanzar el build en cuanto esté el código congelado (mañana temprano); revisar el estado por la web |
| IP LAN cambia / red de la universidad bloquea | Grabar el video el mismo día con la IP fijada; alternativa: hotspot del celular |
| APK con URL LAN no sirve fuera de la red | Distribuir también el video + nota en la entrega; login, mapa, reportes y moderación dependen del backend: desplegarlo en AWS junto a la BD |
| Valhalla sin memoria en host gratuito | Mantener Valhalla en LAN; documentar el despliegue del backend con VALHALLA_URL local |
