# 11. Conexión del front móvil a la BD del equipo (Supabase OmniTravel)

> **Documento histórico.** Desde 2026-10-18 la BD de OmniTravel está en **AWS RDS** y la app ya no usa Supabase: todo pasa por el backend NestJS. Los scripts SQL de esta carpeta se conservan como referencia de la lógica que se migró al backend (`backend/src/reportes/`).

> Informe del equipo de front para **Sara (equipo de datos)** y el resto del
> equipo. Fecha de verificación en vivo: **2026-10-17**. El front móvil ya
> está configurado contra el proyecto **"sarafaustino's Project"**
> (organización OmniTravel, ref `scpwrozsjpittiypvwxj`).

## 1. Qué fue verificado en la BD (solo lectura)

| Aspecto | Resultado |
| --- | --- |
| Esquema OmniTravel (PostGIS habilitado) | ✅ 15 tablas de dominio en `public` + metadatos PostGIS |
| Datos semilla | ✅ 5 POIs de Armenia (`poi`), 7 características, 27 valores por POI, 2 retroalimentaciones, usuarios demo |
| Catálogo de roles | ✅ `viajero`(1), `colaborador`(2), `establecimiento`(3), `moderador`(4), `administrador`(5) |
| Supabase Auth | ✅ 1 usuario creado (`viajero1@omnitravel.test`) vinculado a `usuario.id_usuario=3` vía `auth_user_id` |
| **Políticas RLS** | ✅ Aplicadas el **2026-10-17** con autorización de la responsable del front (`peticiones-front.sql`): lectura pública de `poi`/catálogo/valores/`retroalimentacion`/`rol`, registro en `usuario` y perfil propio. Verificación posterior: lecturas 200 con datos, INSERT 201, fila de prueba eliminada |
| Storage (buckets) | ⚠️ Sin buckets para evidencia fotográfica (proceso 1, fase 3) |

## 2. Esquema real → contrato del front (mapeo implementado)

El front mantiene el contrato C4 (`mobile-app/src/services/types.ts`) y el
mapeo vive en `mobile-app/src/services/pois.ts`:

| Tabla real (BD de Sara) | Contrato front | Notas de mapeo |
| --- | --- | --- |
| `poi` | `Poi` | `id_poi` (int8) → `id` string; `tipo` → `categoria` capitalizada; `ubicacion` (WKB hex con SRID) → `latitud/longitud` |
| `poi.estado` | `estadoVerificacion` | `'publicado'` → `VERIFICADO`; `'pendiente'` → `PENDIENTE`. ⚠️ Discrepancia con los valores del doc 04 (`PENDIENTE/EN_REVISION/VERIFICADO`) — registrar la decisión del equipo |
| `caracteristica_accesibilidad` | `CaracteristicaAccesibilidad` | nombres → ids estables (`ancho_puerta`, `tiene_rampa`, …); `tipo_valor` solo admite `booleano`/`numerico` hoy |
| `valor_accesibilidad_poi` | `ValorAccesibilidad` | una fila por POI+característica (iguales al doc 04) |
| `retroalimentacion` | `ExperienciaViajero` + agregados | media de `calificacion`, conteo → `calificacion`/`totalExperiencias`; `autor` genérico hasta tener JOIN con `usuario` |
| `reporte` + `confirmacion` | `Poi.confirmaciones` | conteo de confirmaciones por POI vía `reporte_id` |
| `usuario` (+`auth_user_id`) | Registro/Login (U01–U03) | cuenta en Supabase Auth + fila de `usuario` vinculada |

Falta en la BD vs doc 04: `denuncia` (proceso 1) y `notificacion`
(contrato pendiente por definición — no implementar aún).

## 3. Peticiones al equipo de datos

### Resueltas el 2026-10-17/18 (con autorización de la responsable del front)

1. ~~**Ejecutar las políticas RLS de lectura**~~ ✅ Aplicadas en el SQL Editor
   del proyecto a partir de [`peticiones-front.sql`](./peticiones-front.sql) y
   verificadas de punta a punta con la llave del cliente: `poi` 5 filas,
   catálogo 7, valores 27, `retroalimentacion` 2, `rol` 5; INSERT en
   `usuario` → 201 (la fila de prueba se eliminó después; el SELECT anónimo
   de `usuario` devuelve 0 filas como corresponde).
2. ~~**Permitir el registro de cuentas**~~ ✅ Política INSERT
   `registro_cuenta_viajero` aplicada (U03 ya escribe la fila de `usuario`
   enlazada por `auth_user_id`).
3. ~~**Confirmación de correo bloqueando el acceso (U01)**~~ ✅ El proyecto
   tenía la confirmación de correo activada (default de Supabase):
   los registros quedaban sin confirmar y el inicio de sesión fallaba con
   *"Confirma tu correo electrónico antes de iniciar sesión"*. Se desactivó
   vía config de Auth (`MAILER_AUTOCONFIRM = true`, 2026-10-18): `signUp`
   devuelve sesión inmediata y el flujo U03 → U01 opera sin correo de
   confirmación (proyecto sin SMTP). Revertible desde Authentication →
   Sign In / Up si se configura SMTP propio.
4. ~~**Cuenta de la responsable del front rota en el video de prueba**~~ ✅
   Reparada: auth user confirmada, fila `usuario` #11 creada (rol viajero,
   estado activo, `auth_user_id` vinculado, `password_hash` SHA-256 según
   el esquema) y contraseña de auth normalizada (bcrypt vía pgcrypto).
   Verificación end-to-end con las credenciales de la app: login 200,
   SELECT del perfil propio 200 (RLS `lectura_perfil_propio`) y un registro
   nuevo completo con signUp+sesión 200 + INSERT 201 (filas de prueba
   eliminadas: BD sin restos).

> El lienzo vacío del mapa en un Android real (`mapType="none"` + `UrlTile`
> OSM) es un defecto del front resuelto en el código (mapa base de Google en
> Expo Go); detalle y motivo en `mobile-app/README.md` (Decisiones clave).

### Aún abiertas

3. **Cerrar la discrepancia de estados** del POI (`publicado`/`pendiente`
   vs `PENDIENTE`/`EN_REVISION`/`VERIFICADO` del doc 04) — decisión del
   equipo; el front ya mapea ambos lados.
4. Cuando entren las fases 3/6: buckets de Storage para `evidencia` y
   políticas de escritura para `retroalimentacion`/`reporte`.

### ENTREGA 2 — escritura del Proceso 1 (2026-10-18)

Para la Entrega 2 el front ya redactó el script completo de la vía de
escritura del Proceso 1: **[`peticiones-front-entrega2.sql`](./peticiones-front-entrega2.sql)**.
Incluye, con arranque en un bloque de DIAGNÓSTICO (leer antes de ejecutar):

1. Esquema mínimo aditivo: `reporte.es_critico`, tabla
   `decision_moderacion` (auditoría RNF-30) e índices de apoyo.
2. Políticas RLS de lectura del crowdsourcing + lectura de decisiones solo
   para moderación.
3. RPCs transaccionales (`security definer`): `crear_reporte`,
   `confirmar_reporte` (consenso de 3, anti-autoconfirmación, publicación
   exactamente una vez), `decidir_reporte` (aprobación/rechazo con motivo) y
   `listar_reportes_moderacion` (M03/M04).
4. Bucket `evidencia` con límite de 5 MB y MIME de imagen (RNF-28) y
   políticas de subida por carpeta de usuario.
5. Semilla del reporte de demostración del POI 5 y verificación final.

**EJECUTADO el 2026-10-18** por el lado del front con dos ajustes del
diario (detalle en el encabezado del script): (1) §3 (funciones auxiliares)
se ejecutó antes de §2 porque la política de moderación referencia
`es_moderador()`; (2) el CHECK real de `reporte.estado` es
`{'pendiente_validacion','publicado','rechazado','en_revision'}` — NO acepta
`'pendiente'` — por lo que las RPCs quedaron con `pendiente_validacion` y el
front alineó sus literales (detalle U08 con doble soporte heredado,
moderación M03 y servicio de reportes). `via_resolucion` queda anotado
('automatica' al publicar por consenso de 3, 'manual' por decisión de
moderación). Verificación con sesión real:
`usuario_actual_id()` = 11; `crear_reporte` creó POI + reporte + 2 valores
y se limpiaron; `listar_reportes_moderacion` sin rol → ACCESO_DENEGADO ✓.
La semilla demo del POI 5 queda en `pendiente_validacion` (id_reporte 6,
0/3 confirmaciones) lista para la demo del consenso.

### GUARDADOS — favoritos (2026-10-18, EJECUTADO)

`peticiones-front-guardados.sql`: la tabla `favorito` tenía RLS activada
SIN políticas (denegaba todo al cliente). Se crearon
`guardados_lectura_propia` (SELECT), `guardados_inserta_propia` (INSERT) y
`guardados_elimina_propia` (DELETE) para `authenticated`, todas acotadas con
`usuario_id = public.usuario_actual_id()` (dueño vía `auth_user_id`).
Verificado con sesión real: INSERT 201 · lectura propia OK · filas de
otros usuarios invisibles · DELETE 204 · 0 filas huérfanas.

> **Nota para producción/evaluación:** la política `registro_cuenta_viajero`
> usa `with check (true)` (roles anon+authenticated) para que U03 funcione
> con o sin confirmación de correo. Para un entorno productivo se recomienda
> restringirla a `to authenticated with check (auth_user_id = auth.uid())`,
> disponible también en el SQL de referencia.

## 4. Qué quedó hecho en el front (entrega)

- **Configuración** `.env` (no versionado) con URL + publishable key del
  proyecto; `config.ts` exige las credenciales con error accionable.
- **Autenticación**: `services/supabase/auth.ts` (Supabase Auth
  signUp/signIn + vinculación `usuario.auth_user_id`), sesión persistida
  cifrada (expo-secure-store). Pantalla U01/U02 de inicio de sesión nueva.
- **Datos reales**: `services/pois.ts` + `store/poisStore.ts` cargan POIs,
  catálogo y valores desde la BD con fallback a mocks tipados si la lectura
  aún está bloqueada por RLS; Mapa (U06) y Detalle (U08) consumen el store.
- **Cerrar sesión** también desloguea de Supabase Auth (U12).
- **Guardados reales**: `services/favoritos.ts` + `store/favoritosStore.ts`
  sincronizan el corazón (U08) con la tabla `favorito` (políticas del dueño
  `guardados_*`): lista en el tab con tarjetas y botón quitar, carga lazy,
  rollback optimista si la BD rechaza la operación.
- **Contribuir operativo de lado BD**: la pantalla `ContributeScreen` ya
  usa las
  RPCs de la Entrega 2 (ejecutadas) — `crear_reporte` verificado con la
  sesión real de la app (estado `pendiente_validacion` + consenso 0/3 de la
  semilla del POI 5 lista para demostrar la publicación comunitaria).
- **Mapa U06 en WebView + Leaflet**: el nativo `react-native-maps` quedó
  intermitente en Expo Go Android; `components/MapaWeb.tsx` pinta tiles OSM
  sin API keys con marcadores/polyline vía puente postMessage.
- Parser geoespacial puro y probado (`services/coordenadas.ts`,
  65 pruebas unitarias en 9 suites, typecheck + lint en verde).

## 5. Avisos de privacidad (RNF-20/25/09)

- El perfil de accesibilidad (necesidades) sigue siendo **100 % local**
  (Ley 1581): nunca viaja a la BD.
- Las llaves en `.env` son la *publishable* (pública por diseño); ninguna
  clave secret/service_role está en el código ni en el repo.
