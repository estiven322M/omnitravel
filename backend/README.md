# OmniTravel — Backend (NestJS)

API de OmniTravel: autenticación propia (bcrypt + JWT), mapa, reportes con
consenso comunitario, moderación, evidencias y ruteo accesible con Valhalla.
Integra el trabajo de las ramas `feature/conexion_bd_yamis` (backend que usa la
app) y `main` (roles, Swagger, diagnóstico y consultas de solo lectura).

## Puesta en marcha

```bash
nvm use            # Node 24 (.nvmrc): NestJS 12 se distribuye como ESM
npm ci
cp .env.example .env
npm run start:dev  # http://localhost:3000 — documentación en /api/docs
npm test           # pruebas unitarias
```

## Base de datos — PostgreSQL en AWS RDS

El backend es la **única** puerta a la BD (`omnitravel_db` en AWS RDS, con
PostGIS). Conexión con TypeORM en `src/app.module.ts` (`synchronize: false`:
las tablas ya existen y no se modifican desde el código).

Variables en `backend/.env` (plantilla en `.env.example`):

| Variable | Uso |
|---|---|
| `DATABASE_URL` | `postgresql://USUARIO:CONTRASEÑA@HOST.rds.amazonaws.com:5432/omnitravel_db` |
| `DB_SSL` | `true` para RDS |
| `DB_SSL_CA` | opcional: certificado de la CA de RDS (ruta a un `.pem` o el certificado pegado) para verificar el servidor |
| `JWT_SECRET` | firma de los tokens de sesión (≥ 32 caracteres; en producción el backend no arranca con uno débil) |
| `CORS_ORIGINS` | opcional: orígenes web permitidos; por defecto Expo web local |
| `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` | opcional: activa la telemetría `@nestjs/observe` |
| `EVIDENCIAS_DIR` | carpeta de fotos (temporal hasta S3; por defecto `uploads/evidencia`) |

Migraciones SQL aditivas en `sql/` (ej. `001-reporte-es-critico.sql`).

### Endpoints

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| `POST` | `/auth/register` | público | Crear cuenta (rol viajero) → `{ token, usuario }` |
| `POST` | `/auth/login` | público | Iniciar sesión → `{ token, usuario }` |
| `GET` | `/mapa` | público | POIs, catálogo, valores, reportes y confirmaciones |
| `GET` | `/pois/:id/reporte-activo` | público | Reporte vigente del POI con su conteo |
| `POST` | `/reportes` | JWT | Crear reporte (lugar nuevo o actualización) |
| `POST` | `/reportes/:id/confirmaciones` | JWT | Confirmar; la 3.ª confirmación publica |
| `GET` | `/moderacion/reportes?estado=` | JWT moderador | Consola M03/M04 |
| `POST` | `/moderacion/reportes/:id/decision` | JWT moderador | Aprobar/rechazar con motivo (tabla `moderacion`) |
| `GET` | `/reportes/mios` | JWT | «Mis reportes» de la persona autenticada (U12) |
| `GET` | `/reportes/barreras` | público | Barreras críticas vigentes para el mapa (U06) |
| `GET` / `PUT` / `DELETE` | `/favoritos`, `/favoritos/:poiId` | JWT | Guardados del viajero (idempotentes) |
| `GET` | `/moderacion/resumen` | JWT moderador | Tablero M02 y desempeño M07 |
| `GET` | `/moderacion/incidencias` | JWT moderador | Incidencias post-viaje abiertas (M06) |
| `POST` | `/moderacion/incidencias/:id/desactivar-punto` | JWT moderador | El POI vuelve a revisión y se cierra la incidencia (auditado) |
| `POST` | `/moderacion/incidencias/:id/solicitar-evidencia` | JWT moderador | Abre una re-verificación comunitaria (idempotente) |
| `POST` | `/auth/cambiar-contrasena` | JWT | `{ actual, nueva }` (M07) |
| `POST` | `/evidencias` | JWT | Subir foto `{ base64, mimeType }` (JPG/PNG/WEBP ≤ 5 MB) |
| `GET` | `/evidencias/archivo/:usuario/:archivo` | público | Leer foto |
| `POST` | `/routes` | JWT | Ruta peatonal accesible (ver abajo) |
| `GET` | `/health` | público | Estado del proceso |
| `GET` | `/users/me` | JWT | Cuenta autenticada con su rol vigente |
| `GET` | `/pois?tipo=&search=&page=&limit=` | JWT | POIs publicados, paginados |
| `GET` | `/pois/nearby?lat=&lon=&radio=&page=&limit=` | JWT | POIs cercanos (PostGIS) |
| `GET` | `/pois/:id` | JWT | Detalle de un POI publicado |
| `GET` | `/reports?page=&limit=` | JWT | Reportes paginados (solo lectura) |
| `GET` | `/reports/:id` | JWT | Detalle de un reporte (solo lectura) |
| `GET` | `/database/diagnostic` | JWT administrador | Versión de PostgreSQL y PostGIS |

> Crear y confirmar reportes se hace **solo** con `POST /reportes` y
> `POST /reportes/:id/confirmaciones`, que aplican el consenso de 3
> confirmaciones y prohíben confirmar el propio reporte. Las versiones de
> escritura de `/reports` se retiraron al integrar `main` para no tener una
> segunda vía que se saltara esas reglas.

### Autenticación y roles

- `POST /auth/login` y `POST /auth/register` devuelven un JWT (24 h). Límite:
  10 intentos por minuto por IP (`429 DEMASIADOS_INTENTOS`).
- `JwtAuthGuard` protege los módulos de la app (reportes, moderación, evidencias).
- `AuthGuard` (módulos pois/reports/users/diagnóstico) además relee la cuenta y
  su rol en la BD en cada petición: un rol revocado o una cuenta suspendida
  dejan de valer de inmediato.
- `@Roles('administrador', …)` + `RolesGuard` restringen por rol.
- Swagger en `/api/docs` (botón *Authorize* con el JWT).

### Cuentas de moderación (M01)

La app **nunca** permite registrarse como moderador o administrador: el
registro siempre crea viajeros. Esas cuentas las crea alguien del equipo con
acceso a la base de datos:

```bash
npm run crear-admin -- correo@omnitravel.edu.co               # administrador
npm run crear-admin -- correo@omnitravel.edu.co moderador     # moderador
```

- Si el correo ya existe, solo le asigna el rol (y reactiva la cuenta).
- Si no existe, crea la cuenta y pide la contraseña sin mostrarla (o la toma
  de `ADMIN_PASSWORD`). Aplica la misma política que el registro.
- Usa `DATABASE_URL`, `DB_SSL` y `DB_SSL_CA` de `backend/.env`.

En la app se entra por **¿Eres moderador? Panel de Moderación** (pantalla
M01); una cuenta sin rol de moderación no pasa de esa pantalla.

Los errores de negocio llegan como `message: "CODIGO: mensaje"` (ej.
`AUTOCONFIRMACION: No puedes confirmar tu propio reporte.`).

### Copiar los datos desde Supabase

```bash
# en backend/.env agrega SUPABASE_DB_URL (y SUPABASE_URL para las fotos)
node --env-file=.env scripts/copiar-supabase-a-aws.mjs --simular
node --env-file=.env scripts/copiar-supabase-a-aws.mjs --reemplazar
```

## API OmniTravel — `POST /routes` (Proceso 2)

Ruteo peatonal accesible contra Valhalla. Contrato y decisiones en
`src/routing/valhalla-payload.ts`; pruebas unitarias en
`src/routing/valhalla-payload.spec.ts`.

```http
POST /routes
Content-Type: application/json

{
  "origin": [4.537, -75.675],
  "destination": [4.53389, -75.68111],
  "restrictions": {
    "perfil": "silla_de_ruedas",     // o "visual" / "peatonal"
    "avoidStairs": true,
    "requireElevator": true,
    "preferSoundTrafficLights": false
  }
}
```

Respuesta normalizada (aislada del formato Valhalla):

```json
{
  "distanciaKm": 1.24, "duracionMin": 15.4, "perfil": "silla_de_ruedas",
  "shape": "<polyline6>",
  "pasos": [{ "tipo": 10, "instruccion": "Gira a la derecha.", "distanciaKm": 0.8 }],
  "advertencias": []
}
```

- Valhalla no tiene costing `wheelchair`: se usa `costing: 'pedestrian'` con
  `costing_options.pedestrian.type` (`wheelchair` / `blind`).
- Errores: `BadRequestException` para coordenadas inválidas y
  `InternalServerErrorException` (mensaje en español) si el motor no responde.
- Variable de entorno: `VALHALLA_URL` (por defecto `http://localhost:8002`).

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
