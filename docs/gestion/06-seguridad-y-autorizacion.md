# 06. Seguridad y autorización

## Autenticación
El objetivo (C4/RNF-06) es autenticar a todos los usuarios mediante JWT gestionado de forma centralizada en el backend. **Estado actual (2026-10-18)**: implementado. La app autentica contra el backend (`POST /auth/register`, `POST /auth/login`; `mobile-app/src/services/api/auth.ts`), que guarda las cuentas en la tabla `usuario` de la BD en AWS RDS y emite un JWT propio (expiración 24 h). La app guarda el token cifrado en el dispositivo (expo-secure-store) para cumplir RNF-08.

Decisión tomada (ADR-09): cuentas propias en el backend NestJS; Supabase ya no se usa. Reglas:

- Los únicos endpoints públicos son `POST /auth/register`, `POST /auth/login` y la consulta pública del mapa (decisión pendiente: si el mapa es público solo con POI `VERIFICADO`). Todo lo demás exige token vigente salvo excepción explícita aprobada.
- El servidor debe validar firma, expiración, algoritmo permitido y claims necesarios; nunca aceptar roles o identidad enviados libremente por el cliente.
- Identidad de operaciones: tomada del JWT validado (guard/decorador), nunca de ids, roles o correos enviados en el cuerpo.

## Contraseñas y cuentas
- Las contraseñas las gestiona el backend con hash adaptativo (bcrypt). Las cuentas copiadas desde Supabase traen SHA-256 y se convierten a bcrypt en su primer login.
- Registro exige aceptación explícita de la política de tratamiento de datos (Ley 1581 de 2012); conservar la marca de aceptación y momento (pantalla U03).
- Los moderadores se identifican con dominio corporativo `@omnitravel.edu.co` (M01); el rol no se deduce de un prefijo de correo en el cliente: lo asigna el backend y viaja en claims del JWT.

## Autorización (RBAC + pertenencia)
La autorización requiere comprobar rol **y** pertenencia/alcance del recurso.

| Actor | Alcance resumido |
|---|---|
| `VIAJERO_ADI` / `COLABORADOR` / `ESTABLECIMIENTO` | Mapa y reportes comunes; reportes sobre lugares que visitan; retroalimentar solo trayectos/visitas finalizados; consultar sus propios reportes y notificaciones. |
| `ESTABLECIMIENTO` | Adicionalmente registra o confirma la información de accesibilidad de sus propios locales (gestión de la vinculación de locales: [pendiente de diseño]). |
| `MODERADOR` / `ADMIN` | Módulo Administrador/Moderador completo (M01–M07): reportes, denuncias, incidencias, reglas de consenso y auditoría. |

- Los listados deben filtrar por pertenencia en el backend; el filtrado en la app es solo UX.
- La decisión del moderador es ejecutiva y sobreescribe el consenso comunitario, pero solo dentro de su rol (RNF-09).
- Para recursos ajenos: `403 ACCESS_DENIED`.

## Datos personales y datos sensibles (Ley 1581 de 2012)
- RNF-07: los datos detallados de discapacidad (tipo/grado, diagnósticos) viven **solo** en el almacenamiento local seguro del dispositivo; el backend no los registra ni persiste. Para el ruteo se envían parámetros de restricción anónimos y temporales.
- En comentarios y perfil de las experiencias evitar exponer condiciones de salud no autorizadas; moderación de contenido sensible.
- Evidencia fotográfica: evitar rostros y placas de terceros; validar MIME/tamaño (RNF-29) antes de aceptar el archivo; cifrado AES-256 para campos clasificados como sensibles.
- Logs sin PII ni tokens; retención documentada de evidencias y auditoría (RNF-30) acorde a la política de privacidad.
- La revisión técnica no reemplaza la validación legal de cumplimiento (Ley 1581 de 2012: aviso de privacidad en U03, habeas data y consentimientos).

## Errores y respuestas
- `400`: formato o validación de campos. `401`: sin autenticación/token inválido o vencido. `403`: rol o alcance insuficiente. `404`: recurso inexistente. `409`: duplicado o conflicto de estado (p. ej. confirmación duplicada, decisión sobre reporte ya resuelto). `422`: regla de negocio incumplida.
- Estructura `Error { timestamp, status, code, message, details, path }`: `code` estable (inglés) y `message` de presentación en español. El frontend nunca decide por `message`.
- Códigos de error propuestos: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `USER_INACTIVE`, `ACCESS_DENIED`, `NOT_FOUND`, `EMAIL_ALREADY_REGISTERED`, `DATA_POLICY_NOT_ACCEPTED`, `DUPLICATE_POI`, `DUPLICATE_CONFIRMATION`, `SELF_CONFIRMATION`, `ALREADY_PUBLISHED`, `REPORT_ALREADY_RESOLVED`, `ALREADY_REVIEWED`, `TOO_EARLY`, `ROUTE_ENGINE_ERROR`, `BARRIER_BLOCKED`, `FILE_REJECTED`, `INVALID_STATE`, `INTERNAL_ERROR`.

## CORS y secretos
- Orígenes permitidos explícitos (expo app scheme + front web compartido); no comodines con credenciales.
- Credenciales de la BD (AWS RDS), `JWT_SECRET`, S3 y push solo en variables de entorno del backend; la app solo conoce la URL del backend y guarda su token en secure store.
- Sin acceso directo de la app a la BD: el esquema en AWS RDS solo es accesible desde el backend (security group de RDS restringido).

## Pruebas obligatorias
- Token ausente, inválido y expirado en todos los endpoints protegidos (RNF-06/RNF-08).
- Usuario con rol incorrecto: `403`.
- Manipulación de ids de reportes/POI ajenos: `403` y sin fugas de información.
- Autoconfirmación del creador del reporte y confirmación duplicada: rechazadas (RNF-28).
- Moderador accediendo a funciones fuera de su rol: imposible (RNF-09).
- Archivo no permitido (MIME/tamaño): rechazo (RNF-29).
- Sin exposición de hash, token o datos de menores en respuestas/log.
