# Casos de prueba funcionales — OmniTravel

Casos de ejecución **manual** (Expo Go / APK y Postman) para los dos procesos de
negocio de esta fase. Complementan las 19 pruebas unitarias automatizadas
(CP-001 a CP-019, ver la tabla de trazabilidad al final).

- **Requisitos:** `RF-01` = Proceso 1 (Validación Colaborativa de Infraestructura);
  `RF-02` = Proceso 2 (Planificación de Rutas Accesibles). Entre paréntesis va el
  ID detallado de `docs/gestion/02-requisitos-funcionales.md` y el RNF aplicable.
- **Colección Postman:** `postman/omnitravel.postman_collection.json`. Variables:
  `baseUrl` (ej. `http://localhost:3000` o `http://<IP-LAN>:3000`), cuentas demo
  `emailA…emailD` / `passwordA…passwordD`, y los tokens que guarda la carpeta
  «00 · Preparación».
- **Autenticación:** todos los endpoints de escritura y `POST /routes` exigen
  `Authorization: Bearer <JWT>` del backend (`POST /auth/login`).
- **Estados reales de la BD:** `reporte.estado` = `pendiente_validacion` →
  `publicado` (o `rechazado`); `poi.estado` = `pendiente` → `publicado`.
- **Ambiente:** backend NestJS + PostgreSQL/PostGIS en AWS RDS (`omnitravel_db`)
  + Valhalla en Docker (`localhost:8002`) con el grafo del Quindío.

---

## Proceso 1 — Validación Colaborativa de Infraestructura

### CP-020 · Registrar un reporte válido desde el celular

| Campo | Detalle |
|---|---|
| **ID** | CP-020 |
| **Título** | Registro de un nuevo reporte válido se guarda como pendiente de validación |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar que un reporte completo enviado desde la app se guarda en PostgreSQL con estado `pendiente_validacion` y crea el lugar en estado `pendiente`. |
| **Requisito asociado** | RF-01 (C1, RNF-15) |
| **Precondiciones** | Backend y BD activos. Cuenta demo A con sesión iniciada en la app (o `{{tokenA}}` en Postman). GPS activo en el celular. |
| **Entradas** | `POST {{baseUrl}}/reportes` con `{"nombre":"Museo del Oro Quimbaya","tipoPoi":"museo","direccion":"Av. Bolívar #40N-80","lat":4.5534,"lon":-75.6586,"descripcion":"Rampa de acceso en la entrada principal","esCritico":false,"caracteristicas":[]}` |
| **Pasos** | 1. En la app abrir **Contribuir** (U09). 2. Elegir «Lugar nuevo». 3. Escribir nombre y descripción y usar la ubicación GPS. 4. (Opcional) adjuntar foto. 5. Marcar características (U10) y enviar. 6. En Postman (o el cliente SQL) consultar `GET {{baseUrl}}/reports/{{reporteId}}`. |
| **Resultado esperado** | HTTP **201** con `{ "id_reporte": <n>, "id_poi": <n>, "estado": "pendiente_validacion" }`. La app confirma el envío. En la BD: fila en `reporte` con `estado = 'pendiente_validacion'`, `usuario_creador_id` = cuenta A, y fila en `poi` con `estado = 'pendiente'`. |
| **Resultado obtenido** | |

### CP-021 · Rechazar un reporte con un campo obligatorio vacío

| Campo | Detalle |
|---|---|
| **ID** | CP-021 |
| **Título** | Registro de reporte sin nombre del lugar responde HTTP 400 |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar que el backend rechaza un lugar nuevo sin un campo obligatorio y no guarda nada. |
| **Requisito asociado** | RF-01 (C1) |
| **Precondiciones** | `{{tokenA}}` vigente. |
| **Entradas** | `POST {{baseUrl}}/reportes` con `{"nombre":"","lat":4.5534,"lon":-75.6586,"descripcion":"Sin nombre"}` |
| **Pasos** | 1. Enviar la petición desde Postman (la app bloquea el envío antes; esta prueba verifica que el servidor también valida). 2. Revisar la respuesta. 3. Comprobar en la BD que no se creó ningún `poi` ni `reporte` nuevo. |
| **Resultado esperado** | HTTP **400** con `message: "DATOS_INCOMPLETOS: El lugar necesita nombre y ubicación."`. Sin filas nuevas en `poi` ni `reporte`. Variante: `lat: 200` responde 400 con «fuera de rango». |
| **Resultado obtenido** | |

### CP-022 · Consultar puntos en una zona con reportes publicados

| Campo | Detalle |
|---|---|
| **ID** | CP-022 |
| **Título** | El mapa muestra los marcadores de los lugares publicados de la zona |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar que los lugares publicados en la BD se dibujan en el mapa (U06) en su ubicación correcta. |
| **Requisito asociado** | RF-01 (P1, P3) |
| **Precondiciones** | Hay al menos un lugar con `poi.estado = 'publicado'` en Armenia (por ejemplo, el de CP-024 o un dato copiado). |
| **Entradas** | `GET {{baseUrl}}/mapa` (público). Zona: centro de Armenia (≈ 4.5339, −75.6811). |
| **Pasos** | 1. Ejecutar la petición en Postman y anotar `id_poi`, `estado` y `ubicacion.coordinates` de un lugar publicado. 2. En la app abrir el **Mapa** y centrarlo en Armenia. 3. Tocar el marcador del lugar y abrir su detalle (U08). |
| **Resultado esperado** | HTTP **200** con `pois[]` que incluye el lugar con `estado: "publicado"` y `ubicacion: {"type":"Point","coordinates":[lon, lat]}`. En la app el marcador aparece en esa posición, como verificado, y el detalle muestra su nombre y su ficha de accesibilidad. |
| **Resultado obtenido** | |

### CP-023 · Consultar una zona sin reportes

| Campo | Detalle |
|---|---|
| **ID** | CP-023 |
| **Título** | Una zona sin reportes carga el mapa vacío sin errores |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar que desplazar el mapa a una zona sin datos no produce errores ni marcadores falsos. |
| **Requisito asociado** | RF-01 (P1) |
| **Precondiciones** | App con sesión iniciada. No hay lugares registrados en la zona elegida. |
| **Entradas** | Zona sin datos: área rural fuera de Armenia (ej. ≈ 4.40, −75.80). |
| **Pasos** | 1. Abrir el **Mapa**. 2. Desplazarlo y acercarlo a la zona elegida. 3. Esperar la carga. |
| **Resultado esperado** | El mapa se ve sin marcadores en esa zona, sin mensaje de error, sin cierre de la app y sin bloquear la interacción. (Prueba visual: `GET /mapa` no filtra por zona, devuelve todos los lugares.) |
| **Resultado obtenido** | |

### CP-024 · La tercera confirmación publica el lugar

| Campo | Detalle |
|---|---|
| **ID** | CP-024 |
| **Título** | Tercera confirmación comunitaria cambia el estado a publicado |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar la regla de consenso: con 3 confirmaciones de usuarios distintos el reporte y el lugar pasan a `publicado`. |
| **Requisito asociado** | RF-01 (C3, RNF-18, RNF-23) |
| **Precondiciones** | Reporte de CP-020 (`{{reporteId}}`) en `pendiente_validacion` con 0 confirmaciones, creado por la cuenta A. Cuentas B, C y D con sesión (`{{tokenB}}`, `{{tokenC}}`, `{{tokenD}}`). |
| **Entradas** | `POST {{baseUrl}}/reportes/{{reporteId}}/confirmaciones` (sin cuerpo), una vez con cada token B, C y D. |
| **Pasos** | 1. Confirmar con B. 2. Confirmar con C. 3. Confirmar con D. 4. Consultar `GET {{baseUrl}}/pois/{{poiId}}/reporte-activo`. 5. En la app, abrir el detalle del lugar con la cuenta D. |
| **Resultado esperado** | Respuestas **201**: B → `{"confirmaciones":1,"publicado":false}`, C → `{"confirmaciones":2,"publicado":false}`, D → `{"confirmaciones":3,"publicado":true}`. `reporte-activo` devuelve `estado: "publicado"`. En la app aparece el modal «Consenso alcanzado» (S01) y el lugar se ve como verificado. |
| **Resultado obtenido** | |

### CP-025 · Con una sola confirmación el lugar no es público

| Campo | Detalle |
|---|---|
| **ID** | CP-025 |
| **Título** | Con solo 1 confirmación el punto sigue pendiente y no se muestra como verificado |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar que el consenso no se adelanta: menos de 3 confirmaciones no publican el lugar. |
| **Requisito asociado** | RF-01 (C3, RNF-23) |
| **Precondiciones** | Un reporte nuevo (`{{reporteId2}}`, lugar `{{poiId2}}`) creado por la cuenta A, con 0 confirmaciones. |
| **Entradas** | `POST {{baseUrl}}/reportes/{{reporteId2}}/confirmaciones` con `{{tokenB}}`; luego `GET {{baseUrl}}/pois/{{poiId2}}/reporte-activo` y `GET {{baseUrl}}/mapa`. |
| **Pasos** | 1. Confirmar una sola vez con B. 2. Consultar el reporte activo. 3. Buscar `{{poiId2}}` en `GET /mapa`. 4. Ver el lugar en el mapa de la app. |
| **Resultado esperado** | Confirmación **201** con `{"confirmaciones":1,"publicado":false}`. `reporte-activo` devuelve `estado: "pendiente_validacion"` y `confirmaciones: 1`. En `/mapa` el lugar tiene `estado: "pendiente"`. En la app se ve marcado como pendiente, no como verificado. |
| **Resultado obtenido** | |

### CP-026 · Un usuario no puede confirmar dos veces el mismo reporte

| Campo | Detalle |
|---|---|
| **ID** | CP-026 |
| **Título** | Confirmación duplicada del mismo usuario se rechaza (y el autor no puede autoconfirmar) |
| **Proceso de negocio** | Proceso 1 — Validación Colaborativa de Infraestructura |
| **Objetivo de la prueba** | Verificar la protección del consenso implementada: una confirmación por usuario y por reporte, y ninguna del autor. |
| **Requisito asociado** | RF-01 (C3, RNF-28) |
| **Precondiciones** | Reporte de CP-025 ya confirmado una vez por B. |
| **Entradas** | 1) `POST {{baseUrl}}/reportes/{{reporteId2}}/confirmaciones` otra vez con `{{tokenB}}`. 2) La misma petición con `{{tokenA}}` (autor). |
| **Pasos** | 1. Repetir la confirmación con B. 2. Intentar confirmar con A. 3. Consultar `reporte-activo`. |
| **Resultado esperado** | 1) HTTP **409** `CONFIRMACION_DUPLICADA: Ya confirmaste este reporte.` 2) HTTP **422** `AUTOCONFIRMACION: No puedes confirmar tu propio reporte.` El conteo sigue en 1. En la app se muestran esos mensajes. |
| **Resultado obtenido** | |

---

## Proceso 2 — Planificación de Rutas Accesibles Personalizadas

### CP-027 · Solicitud válida de ruta peatonal estándar

| Campo | Detalle |
|---|---|
| **ID** | CP-027 |
| **Título** | Solicitud de ruta peatonal válida responde con la ruta |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Verificar que el backend calcula una ruta peatonal con Valhalla y la devuelve normalizada. |
| **Requisito asociado** | RF-02 (RT1, RNF-01) |
| **Precondiciones** | Valhalla activo con el grafo del Quindío. `{{tokenA}}` vigente. |
| **Entradas** | `POST {{baseUrl}}/routes` con `{"origin":[4.5339,-75.6811],"destination":[4.5534,-75.6586],"restrictions":{"perfil":"peatonal"}}` |
| **Pasos** | 1. Enviar la petición. 2. Revisar la respuesta. 3. Repetir en la app eligiendo el Museo del Oro como destino desde el centro. |
| **Resultado esperado** | HTTP **201** (POST de NestJS) con `distanciaKm > 0`, `duracionMin > 0`, `perfil: "peatonal"`, `shape` (polyline6), `pasos[]` no vacío y `advertencias[]`. Respuesta en ≤ 3 s. |
| **Resultado obtenido** | |

### CP-028 · Destino fuera de la zona de cobertura

| Campo | Detalle |
|---|---|
| **ID** | CP-028 |
| **Título** | Destino fuera de cobertura responde con error controlado, sin caída |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Verificar que un destino fuera del grafo cargado en Valhalla produce un error controlado y un mensaje claro. |
| **Requisito asociado** | RF-02 (RT5, RNF-17) |
| **Precondiciones** | `{{tokenA}}` vigente. El grafo cargado solo cubre la región del Quindío. |
| **Entradas** | `POST {{baseUrl}}/routes` con `{"origin":[4.5339,-75.6811],"destination":[4.7110,-74.0721],"restrictions":{"perfil":"peatonal"}}` (destino en Bogotá). |
| **Pasos** | 1. Enviar la petición. 2. Hacer otra petición válida (CP-027) para confirmar que el backend sigue respondiendo. 3. En la app, intentar una ruta a un destino fuera de la región. |
| **Resultado esperado** | Respuesta de error en JSON con `message` legible (sin trazas), el backend no se cae y la siguiente petición válida funciona. La app muestra un mensaje claro con opción de reintentar. *Nota: hoy el backend responde **500** con el texto de Valhalla («Valhalla respondió con 400: …»); si el criterio exige 4xx o un mensaje en español, registrar el defecto.* |
| **Resultado obtenido** | |

### CP-029 · Ruta para silla de ruedas evita escaleras conocidas

| Campo | Detalle |
|---|---|
| **ID** | CP-029 |
| **Título** | Ruta con perfil silla de ruedas bordea un punto con escaleras |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Verificar que con el perfil motriz la ruta evita las escaleras cuando existe alternativa. |
| **Requisito asociado** | RF-02 (RT1, RNF-21, RNF-26) |
| **Precondiciones** | Se identificó un tramo con escaleras en OpenStreetMap (`highway=steps`) entre dos puntos de Armenia, con camino alternativo sin escaleras: `{{escaleraOrigenLat}}`, `{{escaleraOrigenLon}}`, `{{escaleraDestinoLat}}`, `{{escaleraDestinoLon}}` (definirlos antes de ejecutar). `{{tokenA}}` vigente. |
| **Entradas** | `POST {{baseUrl}}/routes` con `{"origin":[{{escaleraOrigenLat}},{{escaleraOrigenLon}}],"destination":[{{escaleraDestinoLat}},{{escaleraDestinoLon}}],"restrictions":{"perfil":"silla_de_ruedas","avoidStairs":true,"requireElevator":true}}` (mismo payload que envía la app para el perfil silla de ruedas). |
| **Pasos** | 1. Enviar la petición. 2. Decodificar `shape` (o verla en la app) y comparar con la ubicación de las escaleras. 3. Revisar `pasos[]`. |
| **Resultado esperado** | HTTP **201**. La ruta no pasa por el tramo de escaleras y ningún paso indica tomar escaleras. Puede ser más larga que la de CP-030. |
| **Resultado obtenido** | |

### CP-030 · La misma ruta sin perfil puede pasar por las escaleras

| Campo | Detalle |
|---|---|
| **ID** | CP-030 |
| **Título** | Sin perfil de accesibilidad la ruta puede usar el tramo con escaleras |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Confirmar, como contraste de CP-029, que la diferencia de trazado se debe al perfil. |
| **Requisito asociado** | RF-02 (RT1) |
| **Precondiciones** | Mismos puntos de CP-029. |
| **Entradas** | `POST {{baseUrl}}/routes` con `{"origin":[{{escaleraOrigenLat}},{{escaleraOrigenLon}}],"destination":[{{escaleraDestinoLat}},{{escaleraDestinoLon}}],"restrictions":{"perfil":"peatonal"}}` |
| **Pasos** | 1. Enviar la petición. 2. Comparar `shape`, `distanciaKm` y `pasos[]` con los de CP-029. |
| **Resultado esperado** | HTTP **201**. La ruta puede atravesar el tramo de escaleras (más corta) y difiere de la de CP-029. Si ambas son iguales, el punto elegido no tiene escaleras en el grafo: elegir otro. |
| **Resultado obtenido** | |

### CP-031 · Sin camino accesible el sistema avisa

| Campo | Detalle |
|---|---|
| **ID** | CP-031 |
| **Título** | Si no hay camino accesible el sistema avisa en lugar de fallar en silencio |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Verificar que, cuando el motor no puede trazar una ruta para el perfil, la persona recibe un aviso claro. |
| **Requisito asociado** | RF-02 (RT5, RNF-17, RNF-26) |
| **Precondiciones** | Un destino al que solo se llega por escaleras, o sin vía peatonal conectada (`{{sinAccesoLat}}`, `{{sinAccesoLon}}`, definirlo antes). `{{tokenA}}` vigente. |
| **Entradas** | `POST {{baseUrl}}/routes` con `{"origin":[4.5339,-75.6811],"destination":[{{sinAccesoLat}},{{sinAccesoLon}}],"restrictions":{"perfil":"silla_de_ruedas","avoidStairs":true}}` |
| **Pasos** | 1. Enviar la petición. 2. Repetir en la app con perfil silla de ruedas. |
| **Resultado esperado** | O bien una ruta con `advertencias[]` que indique el riesgo, o bien un error con `message` claro; en la app, mensaje visible y opción de reintentar. Nunca una pantalla en blanco ni un cierre. *Nota: `step_penalty` penaliza las escaleras pero no las prohíbe; si el motor devuelve una ruta por escaleras sin advertencia, registrar el defecto contra RNF-26.* |
| **Resultado obtenido** | |

### CP-032 · La polyline se dibuja completa en Expo Go

| Campo | Detalle |
|---|---|
| **ID** | CP-032 |
| **Título** | La polyline de la ruta se dibuja completa y sin saltos |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Verificar que la geometría devuelta por el backend se decodifica y se pinta completa sobre las calles. |
| **Requisito asociado** | RF-02 (RT2) |
| **Precondiciones** | App en Expo Go con sesión; ruta de CP-027 calculable. |
| **Entradas** | Origen: centro de Armenia; destino: Museo del Oro Quimbaya. |
| **Pasos** | 1. Calcular la ruta en el **Mapa**. 2. Acercar el mapa a lo largo del trayecto. 3. Comprobar el inicio, el final y los giros. |
| **Resultado esperado** | La línea empieza en el origen, termina en el destino, sigue las calles y no tiene tramos rectos que crucen manzanas ni cortes. |
| **Resultado obtenido** | |

### CP-033 · Las instrucciones coinciden con los tramos reales

| Campo | Detalle |
|---|---|
| **ID** | CP-033 |
| **Título** | Las instrucciones de navegación paso a paso coinciden con el trazado |
| **Proceso de negocio** | Proceso 2 — Planificación de Rutas Accesibles Personalizadas |
| **Objetivo de la prueba** | Verificar que cada instrucción de `pasos[]` corresponde a un giro o tramo real de la polyline. |
| **Requisito asociado** | RF-02 (RT2) |
| **Precondiciones** | Ruta de CP-027 calculada. |
| **Entradas** | Respuesta de `POST {{baseUrl}}/routes` de CP-027 (`pasos[]`: `tipo`, `instruccion`, `distanciaKm`). |
| **Pasos** | 1. Iniciar la navegación (U07). 2. Recorrer los pasos uno a uno comparándolos con el mapa. 3. Sumar los `distanciaKm` de los pasos. |
| **Resultado esperado** | Cada instrucción (en español) coincide con el giro o la calle que muestra el mapa. La suma de las distancias de los pasos es aproximadamente igual a `distanciaKm` de la ruta. El último paso indica la llegada al destino. |
| **Resultado obtenido** | |

---

## Trazabilidad para TestRail (CP-001 a CP-033)

| ID | Título | Proceso | Tipo | Ubicación |
|---|---|---|---|---|
| CP-001 | Rechaza un lugar nuevo sin nombre | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-002 | Rechaza un lugar nuevo sin ubicación (lat/lon) | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-003 | Acepta un reporte completo | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-004 | Acepta coordenadas válidas, incluidos los límites | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-005 | Rechaza latitud fuera de rango | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-006 | Rechaza longitud fuera de rango | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-007 | Con 1 confirmación sigue pendiente_validacion | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-008 | Con 2 confirmaciones sigue pendiente_validacion | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-009 | Con 3 confirmaciones pasa a publicado | Proceso 1 | Unitaria | `backend/src/reportes/reportes.reglas.spec.ts` |
| CP-010 | Payload básico con origen y destino | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-011 | Costing peatonal por defecto | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-012 | Propagación de opciones de costing con perfil | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-013 | Perfil silla de ruedas penaliza escaleras | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-014 | Perfil peatonal estándar no penaliza escaleras | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-015 | Perfil motriz con ascensor deja de penalizarlos | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-016 | Perfil sensorial (visual) sin impedancias físicas | Proceso 2 | Unitaria | `backend/src/routing/valhalla-payload.plan.spec.ts` |
| CP-017 | Distancia entre dos puntos distintos > 0 | Proceso 2 | Unitaria | `mobile-app/src/__tests__/geo.plan.test.ts` |
| CP-018 | Distancia de un punto a sí mismo = 0 | Proceso 2 | Unitaria | `mobile-app/src/__tests__/geo.plan.test.ts` |
| CP-019 | Coordenadas límite (lat 90, lng 180) sin error | Proceso 2 | Unitaria | `mobile-app/src/__tests__/geo.plan.test.ts` |
| CP-020 | Registro de reporte válido queda pendiente de validación | Proceso 1 | Funcional | Expo Go + Postman |
| CP-021 | Reporte sin nombre responde HTTP 400 | Proceso 1 | Funcional | Postman |
| CP-022 | Mapa muestra los lugares publicados de la zona | Proceso 1 | Funcional | Expo Go + Postman |
| CP-023 | Zona sin reportes carga vacía sin errores | Proceso 1 | Funcional | Expo Go |
| CP-024 | Tercera confirmación publica el lugar | Proceso 1 | Funcional | Expo Go + Postman |
| CP-025 | Con 1 confirmación el lugar no es público | Proceso 1 | Funcional | Expo Go + Postman |
| CP-026 | Confirmación duplicada y autoconfirmación rechazadas | Proceso 1 | Funcional | Expo Go + Postman |
| CP-027 | Ruta peatonal estándar válida | Proceso 2 | Funcional | Expo Go + Postman |
| CP-028 | Destino fuera de cobertura con error controlado | Proceso 2 | Funcional | Expo Go + Postman |
| CP-029 | Ruta silla de ruedas evita escaleras | Proceso 2 | Funcional | Expo Go + Postman |
| CP-030 | Ruta sin perfil puede pasar por escaleras | Proceso 2 | Funcional | Postman |
| CP-031 | Sin camino accesible el sistema avisa | Proceso 2 | Funcional | Expo Go + Postman |
| CP-032 | Polyline completa y sin saltos | Proceso 2 | Funcional | Expo Go |
| CP-033 | Instrucciones coinciden con los tramos | Proceso 2 | Funcional | Expo Go + Postman |
