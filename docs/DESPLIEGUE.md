# Despliegue de OmniTravel en AWS

Todo el sistema corre en **Amazon Web Services** (región `us-east-2`, Ohio), desde la rama `main`:

| | URL |
|---|---|
| Versión web | https://main.dlshn89nrlzf4.amplifyapp.com |
| Backend (API) | https://om-ea9b9c23afe54514b837ef7dfa228a44.ecs.us-east-2.on.aws |

| Pieza | Servicio de AWS | Cómo se publica |
|---|---|---|
| Backend NestJS (API) | **Amazon ECS – Express Mode** (Fargate + Application Load Balancer con HTTPS) | GitHub Actions: imagen Docker → **Amazon ECR** → ECS |
| Versión web | **AWS Amplify Hosting** | GitHub Actions: `expo export -p web` → Amplify |
| Base de datos | **Amazon RDS** – PostgreSQL + PostGIS (`omnitravel_db`) | Ya existente |
| Fotos de evidencia | **Amazon S3** (bucket privado) | El backend las sube con el rol de la tarea de ECS |
| App Android (APK) | EAS Build (Expo) | `eas build -p android --profile preview` |

El motor de ruteo es el servidor público de Valhalla (`valhalla1.openstreetmap.de`).
Ninguna clave va en el código. GitHub entra a AWS con **OIDC** (rol temporal);
como la organización de AWS de la cuenta del equipo bloquea OIDC con una política
SCP, se usa un usuario IAM de mínimos permisos cuyas claves se guardan como
secretos de GitHub Actions.

> **Por qué ECS Express Mode y no App Runner:** AWS App Runner dejó de aceptar
> clientes nuevos el 30 de abril de 2026 y AWS recomienda ECS Express Mode
> como reemplazo.

## 1. Preparar AWS (una sola vez, en CloudShell)

Lo hace quien tenga acceso de administrador a la cuenta de AWS.

1. Entra a la consola de AWS y elige, arriba a la derecha, **la región donde está la base de datos RDS**.
2. Abre **CloudShell** (ícono `>_` en la barra superior).
3. Descarga y ejecuta el script:

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/estiven322M/omnitravel/main/infra/aws/preparar-aws.sh
   bash preparar-aws.sh
   ```

El script crea el repositorio de ECR, el bucket de S3, los roles de IAM
(ECS y GitHub OIDC) y la aplicación de Amplify. Al final imprime los valores
para el paso 2. Se puede ejecutar varias veces sin duplicar nada.

**Base de datos:** el script muestra las reglas del puerto 5432 de RDS. Si
solo permiten ciertas IP, agrega una regla de entrada **PostgreSQL (5432)**
desde el grupo de seguridad del servicio de ECS (aparece en ECS → Clusters →
default → omnitravel-backend → Networking después del primer despliegue).

## 2. Configurar GitHub (una sola vez)

Requiere permisos de administrador del repositorio. En **Settings → Secrets
and variables → Actions**:

| Pestaña | Nombre | Valor |
|---|---|---|
| Variables | `AWS_REGION` | La que imprime el script |
| Variables | `AWS_ACCOUNT_ID` | La que imprime el script |
| Variables | `EVIDENCIAS_BUCKET` | La que imprime el script |
| Variables | `AMPLIFY_APP_ID` | La que imprime el script |
| Variables | `WEB_URL` | La que imprime el script (`https://main.<id>.amplifyapp.com`) |
| Variables | `API_URL` | Se agrega en el paso 3, con la URL del backend |
| Secrets | `DATABASE_URL` | La misma de `backend/.env` |
| Secrets | `JWT_SECRET` | Texto aleatorio de 48 o más caracteres (no el de desarrollo) |
| Secrets | `MODERADOR_EMAIL`, `MODERADOR_CLAVE` | Cuenta de moderador para las pruebas de Postman |
| Secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Solo si la organización de AWS bloquea OIDC (como en nuestra cuenta). El script las deja en `~/claves-github.txt` de CloudShell |

Para generar `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Desplegar

**Actions → «Despliegue (AWS)» → Run workflow.** Después, cada vez que `main`
pasa la CI se despliega solo.

1. El job **Backend** construye la imagen, la sube a ECR y crea o actualiza el
   servicio `omnitravel-backend` en ECS. En el resumen aparece la URL, con la
   forma `https://<servicio>.ecs.<región>.on.aws`.
2. Guarda esa URL como variable **`API_URL`** (paso 2) y vuelve a ejecutar el
   workflow, para que la web y las pruebas la usen siempre.
3. El job **Web** publica la versión web en Amplify (`WEB_URL`).

## 4. App Android (APK)

Pon la URL del backend en `mobile-app/eas.json` (`EXPO_PUBLIC_API_URL` de los
perfiles `preview` y `production`) y genera la APK:

```powershell
npm install -g eas-cli
eas login             # cuenta del equipo (yamis2706s-team)
cd mobile-app
eas build -p android --profile preview
```

EAS entrega un enlace y un QR para instalar la `.apk` en cualquier Android.
En iPhone se usa la versión web.

## 5. Verificación final

1. `<API_URL>/health` responde `{"status":"ok"}` y `<API_URL>/mapa` trae los lugares.
2. La web (`WEB_URL`) abre, inicia sesión y muestra el mapa.
3. Un reporte con foto se guarda: la foto queda en `s3://<bucket>/evidencia/…`.
4. **Actions → Pruebas funcionales → Run workflow**: los 31 casos de Postman pasan.
5. Antes de la sustentación, borra los datos de prueba:

   ```powershell
   cd backend
   npm run limpiar-pruebas                 # muestra qué se borraría
   npm run limpiar-pruebas -- --confirmar  # borra
   ```

## Costos y apagado

El servicio de ECS (1 tarea de 0,5 vCPU / 1 GB) y su balanceador cuestan
entre USD 1 y 1,5 al día; Amplify, ECR y S3 cuestan centavos con este uso.
Después de la calificación se puede eliminar el servicio en **ECS → Clusters
→ default → omnitravel-backend → Delete**, y la app en **Amplify**.
