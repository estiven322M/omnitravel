# Despliegue de OmniTravel

Tres piezas, todas desde la rama `main`:

| Pieza | Dónde | Quién la usa |
|---|---|---|
| Backend NestJS | Railway, servicio existente (`omnitravel-production-4af6.up.railway.app`) | La app Android y la web |
| App Android (APK) | EAS Build (cuenta Expo `yamis2706s-team`) | Cualquier teléfono Android |
| Versión web | Railway, servicio nuevo | iPhone, computadores y cualquier navegador |

La base de datos es AWS RDS (`omnitravel_db`). Ninguna clave va en el código:
todo se configura como variable de cada servicio.

## 1. Backend en Railway

Requisitos: Node 24 en tu computador y la CLI de Railway (si `railway` no
se reconoce en Windows, usa `npx @railway/cli` en su lugar). Railway construye
con `backend/Dockerfile`; al arrancar, el backend descarga la CA de RDS si
falta.

```powershell
npm install -g @railway/cli
railway login
cd backend
railway link          # elige el proyecto del equipo y el servicio del backend
```

Variables del servicio (Railway → servicio → **Variables**):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La misma de `backend/.env` |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | `certs/global-bundle.pem` (el build la descarga) |
| `JWT_SECRET` | Texto aleatorio de 32 caracteres o más (no el de desarrollo) |
| `NODE_ENV` | `production` |
| `VALHALLA_URL` | `https://valhalla1.openstreetmap.de` |
| `CORS_ORIGINS` | La URL de la versión web (paso 3), p. ej. `https://omnitravel-web-production.up.railway.app` |
| `EVIDENCIAS_DIR` | `/data/evidencia` (si agregas el volumen de abajo) |

Para generar `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Fotos de evidencia:** el disco de Railway se borra en cada despliegue.
Agrega un volumen (servicio → **Settings → Volumes → New Volume**, montado
en `/data`) y usa `EVIDENCIAS_DIR=/data/evidencia`.

Desplegar:

```powershell
railway up
```

Comprobar: `https://omnitravel-production-4af6.up.railway.app/health` debe
responder `{"status":"ok"}`, y `.../mapa` debe traer los lugares de la BD.

## 2. App Android (APK) con EAS

`mobile-app/eas.json` ya apunta los perfiles `preview` y `production` al
backend de Railway (`EXPO_PUBLIC_API_URL`).

```powershell
npm install -g eas-cli
eas login             # cuenta del equipo (yamis2706s-team)
cd mobile-app
eas build -p android --profile preview
```

Al terminar (10–20 min), EAS da un enlace y un QR para descargar el `.apk`.
Ese enlace se comparte: cualquier persona con Android lo instala (debe
permitir «instalar apps de origen desconocido»). Cada vez que cambie la app
se repite el build y se comparte el enlace nuevo.

Para Google Play: `eas build -p android --profile production` genera el
`.aab` que se sube a Play Console (requiere cuenta de desarrollador).

**iPhone:** instalar una app fuera del App Store exige la cuenta de Apple
Developer (USD 99/año). Mientras tanto, los usuarios de iPhone usan la
versión web.

## 3. Versión web en Railway

En el mismo proyecto de Railway: **New → Empty Service** (p. ej.
`omnitravel-web`). Railway construye con `mobile-app/Dockerfile` (exporta la
web con Expo y la sirve con `scripts/servir-web.mjs`). Variables:

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://omnitravel-production-4af6.up.railway.app` |

```powershell
cd mobile-app
railway link          # elige el servicio omnitravel-web
railway up
```

Luego **Settings → Networking → Generate Domain**. Esa URL es la de la app
web: ponla en `CORS_ORIGINS` del backend (paso 1) y vuelve a desplegar el
backend con `railway up` desde `backend/`.

## 4. Verificación final

1. `…/health` del backend responde `ok`.
2. La web abre, permite crear una cuenta y muestra los lugares.
3. La APK instalada en un Android inicia sesión y envía un reporte.
4. El reporte aparece en la BD (`npm run ver-usuarios`, pgAdmin o la
   extensión de VS Code).
