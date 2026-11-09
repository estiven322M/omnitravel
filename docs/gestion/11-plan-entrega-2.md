# 11. Plan de trabajo — Entrega 2 (ventana de 48 horas)

> **Actualización 2026-10-18 — BD en AWS:** la base de datos de OmniTravel es **PostgreSQL + PostGIS en AWS RDS** (base `omnitravel_db`). La app ya no usa Supabase: toda lectura y escritura pasa por el backend NestJS (JWT propio, bcrypt). La decisión D1 de este plan (escritura directa a Supabase) quedó reemplazada. Detalle en `05-arquitectura-backend.md` y `backend/README.md`.

> Ciclo: Entrega 2 (25%) · Alcance funcional: **Proceso 1 (Validación Colaborativa de Infraestructura)** y **Proceso 2 (Planificación de Rutas Accesibles Personalizadas)** al 100 % y desplegados · Fecha de redacción: 2026-10-18 · Autora del plan: frente frontend.
>
> Regla de oro de esta ventana: **congelar alcance**. Todo lo que no esté en este plan se ejecuta solo si los bloques P0 están cerrados y verificados. Nada nuevo después del primer tercio del Día 2.

---

## 0. Qué exige la Entrega 2 y cómo estamos hoy

### 0.1 Exigencias del PDF "Entrega 2 Proyecto Omnitravel"

**Desarrollar:**

1. Plan de Gestión de la Calidad del Proyecto (proceso 1 + proceso 2).
2. Software Architecture Description – C4 Model (proceso 1 + proceso 2).
3. Diseño, Reutilización y Pruebas del Software (proceso 1 + proceso 2).
4. Gestión del proyecto en Jira (proceso 1 + proceso 2).
5. Implementar y desplegar los procesos 1 y 2, asegurando su funcionamiento al 100 %.
6. Realizar pruebas funcionales a los procesos 1 y 2, validando su correcto funcionamiento.

**Entregar (solo un integrante por grupo):**

1. Documento: Definición del Proyecto.
2. Documento: Software Architecture Description – C4 Model.
3. Documento: Plan de Gestión de la Calidad del Proyecto.
4. Documento: Diseño, Reutilización y Pruebas del Software.
5. Documento: UI.
6. Documento: manual de usuarios.
7. Link de la aplicación desplegada (adjuntar credenciales de acceso).
8. Link proyecto Jira.

### 0.2 Estado real del repositorio frente a la entrega

| # | Entregable | Estado | Brecha concreta |
|---|---|---|---|
| 1 | Definición del Proyecto | ✅ Existe (`docs/1.` v1.00) | Solo adjuntar |
| 2 | C4 Model | ✅ Existe (`docs/2.`) | Añadir nota/estado de implementación P1–P2 si alcanza el tiempo |
| 3 | Plan de Gestión de la Calidad | ✅ Existe (`docs/3.`, RNF-01..30) | Solo adjuntar |
| 4 | Diseño, Reutilización y Pruebas | ❌ **NO existe** | Crear en 48 h con base en `docs/gestion/08`, el design system de la app y los resultados de pruebas reales |
| 5 | UI (Mockups) | ✅ Existe (`docs/4.`) | Anexar capturas del estado implementado (opcional si hay tiempo) |
| 6 | Manual de usuarios | ❌ **NO existe** | Crear (flujos U01–U10 + U06/U07 + M03–M05) |
| 7 | App desplegada + credenciales | ❌ **NO existe** | No hay `eas.json` ni build; backend solo local; Valhalla local |
| 8 | Link de Jira | ❌ **NO existe** | Crear proyecto Jira y cargar backlog P1/P2 |

### 0.3 Estado del producto (frontend móvil, rama `dev_yamis`)

| Pantalla / capacidad | Mockup | Estado real |
|---|---|---|
| Login / Registro con privacidad | U01–U03 | ✅ Supabase Auth + perfil local cifrado (SecureStore) |
| Feed de inicio | U04 | 🔶 Stub (recorte aprobado para esta entrega) |
| Filtros de accesibilidad | U05 | ✅ Generados del catálogo real |
| Mapa + cálculo de ruta | U06 | ✅ POIs reales + `POST /routes` real con polilínea |
| Navegación paso a paso | U07 | ❌ No existe |
| Detalle del lugar | U08 | ✅ Ficha dinámica + confirmaciones visibles (solo lectura) |
| Crear reporte (crowdsourcing) | U09–U10 | ❌ Stub — **corazón del Proceso 1, faltante** |
| Notificaciones | U11 | ⛔ Excluida (contrato pendiente por definición) |
| Perfil | U12 | 🔶 Parcial (cerrar sesión + necesidades); gamificación recortada |
| Moderación (dashboard, lista, detalle, rechazo) | M01–M07 | ❌ No existe — **vía B del Proceso 1, faltante** |
| Modal Consenso Alcanzado | S01 | ❌ No existe |
| Modal Alerta de Peligro en Ruta | S02 | ❌ No existe |

**Backend (Jhon):** solo `GET /health` y `POST /routes` con `costing: 'auto'` (✗ debe ser peatonal/accesible), sin endpoints de reportes, confirmaciones, moderación ni autenticación.

**Base de datos (Sara):** esquema de 15 tablas con datos semilla, RLS de **lectura** aplicada (POI, catálogo, valores, retroalimentación, rol) y registro de `usuario`. **Falta todo el camino de escritura del Proceso 1:** políticas INSERT de `reporte`/`confirmacion`, regla transaccional de consenso, bucket de evidencia fotográfica y usuario moderador de prueba.

### 0.4 Brecha crítica y decisión estructural

El Proceso 1 **no tiene hoy ninguna vía de escritura** (ni backend ni RLS). En 48 h es inviable que el backend NestJS implemente reportes, confirmaciones transaccionales, moderación y S3.

**Decisión recomendada (D1, cerrar en las primeras 2 horas):** el Proceso 1 escribe **directo a Supabase** (RLS + funciones RPC en Postgres para el consenso atómico), igual que hoy ya lee el front. El backend NestJS se mantiene como capa de ruteo (Proceso 2) y queda documentado como deuda técnica con ADR mínimo de esta ventana ("escritura comunitaria directa a BD con RPC; migrar a API cuando exista el módulo de backend").

---

## 1. Alcance recortado (P0 / P1 / ⛔)

### P0 — sin esto no hay entrega

**Proceso 1 (crowdsourcing):**
1. Crear reporte con foto + GPS + características (U09–U10 simplificado a 3 pasos) → `reporte` en `PENDIENTE_VALIDACION`.
2. Confirmar accesibilidad desde la ficha (U08) con regla de consenso de 3 y anti-autoconfirmación (RPC atómica) + modal **S01**.
3. Moderación mínima vía B: **M03** (lista de reportes), **M04** (detalle + evidencia), **M05** (rechazo con motivo obligatorio; aprobación directa) → decisión ejecutiva que actualiza estado.

**Proceso 2 (rutas):**
4. Ruta con **restricciones del perfil** (`avoidStairs`, `requireElevator`, `preferSoundTrafficLights`) y backend en perfil peatonal.
5. **U07** navegación paso a paso (pasos desde `maneuvers` de Valhalla).
6. Modal **S02** (alerta de peligro + recálculo) y advertencias de datos > 60 días (RNF-27).

**Entrega documental y operativa:**
7. App desplegada: APK vía EAS + backend accesible + credenciales de prueba (viajero y moderador).
8. Pruebas funcionales P1/P2 ejecutadas con evidencia reproducible.
9. Documento "Diseño, Reutilización y Pruebas" + "Manual de usuarios".
10. Jira creado, backlog P1/P2 cargado y estados al día.

### P1 — solo si P0 cierra antes de la mitad del Día 2

- Capturas de pantalla del estado implementado anexas al documento UI.
- **M02** (contador básico de pendientes en la lista de moderación).
- Test unitario de la RPC contra la BD real (integración simple).

### ⛔ Fuera de alcance en esta ventana (documentar como pendiente)

- Proceso 3 completo (F1–F4, M06), U04 feed completo, U11 notificaciones, U12 gamificación, Guardados/favoritos, M01 dedicado (el login existente resuelve el acceso del moderador), M07.

---

## 2. Decisiones bloqueantes — HOY, primeras 2 horas

| ID | Decisión | Opciones | Recomendación | Dueño | Límite |
|---|---|---|---|---|---|
| D1 | Vía de escritura del Proceso 1 | (a) Backend NestJS nuevo · (b) **Supabase directo + RPC** | **(b)** por tiempo; registrar ADR y deuda | Equipo | +2 h |
| D2 | Hosting de backend + Valhalla | (a) Nube (Render/Railway) · (b) **LAN local + video de demo** | (b) para Valhalla; (a) para el API si se puede; el video es evidencia válida | Jhon/Infra | Hoy mediodía |
| D3 | Proyecto Jira | Crear sitio gratuito · enlazar al repo | Crear "OmniTravel" con épica P1 y P2 + historias de este plan | Designado | Hoy |
| D4 | Alcance de moderación | Completa M01–M07 · **Mínima M03/M04/M05** | Mínima; el resto se documenta pendiente | Front | Hoy |
| D5 | Cuentas demo | Cuántas y con qué roles | 3 viajeros + 1 moderador + 1 colaborador (consenso de 3 requiere 3) | Datos | Hoy |

---

## 3. Plan por bloques — Día 1 (Proceso 1)

> Orden pensado para desbloquear primero la BD (Sara) mientras el front construye sin esperar.

### Bloque 0 — Arranque (primeras 2 h) · Todos

- [ ] Cerrar D1–D5 (sección 2).
- [x] **Front:** redactar el script SQL de la ventana y entregarlo a Datos: políticas INSERT (`reporte`, `confirmacion`), trigger/RPC `confirmar_reporte` (valida autor ≠ confirmador, no duplicado por usuario, inserta confirmación y al llegar a 3 actualiza `poi.estado` a publicado de forma atómica), RPC `decidir_reporte` (acción + motivo → estado + auditoría), bucket `evidencia` + políticas, y semilla de cuentas demo (3 viajeros + 1 moderador).
- [ ] **Datos (Sara):** ejecutar el script y verificar con la llave publishable (INSERT 201, RPC OK). Evidencia: captura del SQL Editor + prueba de escritura.
- [x] **Backend:** cambiar `costing: 'auto'` → `'pedestrian'` (perfil `wheelchair`/`blind` vía `costing_options`, que es como Valhalla modela la accesibilidad) y aceptar `restrictions` en el body, devolviendo `pasos` (maneuvers) y `advertencias[]` (`backend/src/routing/valhalla-payload.ts` + spec).
- [ ] **Jira:** crear proyecto, épicas "Proceso 1" y "Proceso 2", cargar las historias de este plan como issues con responsable y estado.

### Bloque 1 — Servicios de datos del Proceso 1 (front) · Día 1 mañana

- [x] `services/reportes.ts`: `crearReporte()` (fila `reporte` + valores por característica), `confirmarReporte()` (RPC), `listarReportesParaModerar()`, `decidirReporte()` (RPC), `denunciarReporte()` solo si sobra tiempo (C4 no bloquea la demo).
- [x] `services/evidencias.ts`: captura con `expo-image-picker` (cámara/galería) + compresión + subida al bucket `evidencia` con degradación elegante (si la subida falla, el reporte se crea marcado "sin evidencia" y se muestra el aviso — RNF-09).
- [x] Extender el flujo de sesión para exponer el **rol** (`rol_id` ya viene en la fila `usuario` del login) y derivar el módulo (viajero/colaborador → app; moderador → consola).
- [x] Pruebas unitarias de los mapeadores y validaciones nuevas. (`reportes.test.ts`, `reporteValidacion.test.ts`, `evidencias.test.ts`, `ruta.test.ts`; 65 pruebas en 9 suites.)

**Verificación del bloque:** `npm.cmd run typecheck` + `npm.cmd test` en verde; INSERT real visible en Supabase.

### Bloque 2 — U09/U10: wizard de reporte (front) · Día 1 tarde

- [x] Paso 1: tipo de reporte (nuevo lugar / actualizar existente / característica de accesibilidad).
- [x] Paso 2: ubicación (GPS con `expo-location` + ajuste de pin) + foto (opcional con aviso).
- [x] Paso 3: formulario dinámico desde el catálogo real + confirmación de éxito (estado `PENDIENTE_VALIDACION` visible al usuario).
- [x] Accesibilidad del wizard: etiquetas, foco, mensajes de error accionables (RNF-11/12/15), ≤ 2 min de diligenciamiento.
- [x] Nota de privacidad visible en el flujo (Ley 1581).

**Verificación:** reporte creado end-to-end desde el dispositivo de demo y fila visible en la BD.

### Bloque 3 — Confirmaciones + S01 (front) · Día 1 tarde/noche

- [x] Botón "Confirmar accesibilidad" en U08 (deshabilitado para el autor y para ya-confirmadores, con mensaje claro — RNF-29).
- [x] Componente modal **S01** (Consenso Alcanzado) accesible y anunciado (RNF-12).
- [x] Al confirmar: llamada a la RPC; al llegar a 3 → el POI pasa a publicado y la UI lo refleja sin recargar (RNF-03/RNF-07).
- [ ] Pruebas: estado del botón por rol/duplicado, S01 visible al consenso.

**Verificación:** demo de 3 confirmaciones con 3 cuentas distintas → POI publicado + S01; intento de autoconfirmación rechazado con mensaje claro.

### Bloque 4 — Moderación mínima M03/M04/M05 (front) · Día 1 noche (timebox 3 h)

- [x] Detección de rol al iniciar sesión → entrada a "Consola de moderación".
- [x] **M03:** lista de reportes pendientes (reutilizar `Card`/`Badge`/`EmptyState`), con motivo de prioridad (barrera crítica / GPS inconsistente).
- [x] **M04:** detalle del reporte con evidencia fotográfica, coordenadas y valores declarados.
- [x] **M05:** modal de decisión — rechazo con **motivo obligatorio**; aprobación directa (acción ejecutiva, RNF-20); auditoría mínima registrada.
- [ ] Si el timebox se agota: recortar M04 a una vista simple de datos y documentar; **no** sacrificar M03/M05.

**Verificación:** moderador rechaza un reporte con motivo → estado actualizado en BD + visible en la app; aprobación publica el POI.

---

## 4. Plan por bloques — Día 2 (Proceso 2 + despliegue + documentos + pruebas)

### Bloque 5 — Proceso 2 UI (front) · Día 2 mañana (primeras 4 h)

- [x] Enviar `restrictions` desde el perfil de accesibilidad en `POST /routes` (motriz → `avoidStairs`/`requireElevator`; sensorial → `preferSoundTrafficLights`). (`restriccionesDesdePerfil` en `utils/ruta.ts`, probado.)
- [x] Advertencia visible cuando la ruta use datos no verificados o de más de 60 días (`warnings[]`, RNF-27).
- [x] **U07:** pantalla de navegación paso a paso con `maneuvers` (instrucción, distancia, ícono direccional) + botón "Finalizar".
- [x] **S02:** modal de alerta de peligro en ruta + acción "Recalcular" (disparo demo: barrera crítica reportada sobre el trayecto o botón de simulación etiquetado para la demo).
- [x] Manejo de fallo del motor: mensaje claro y alternativa (ya existe base en U06, extender a U07 — RNF-09).

**Verificación:** ruta con restricciones + pasos visibles + S02 con recálculo + advertencia de datos antiguos, todo en dispositivo.

### Bloque 6 — Despliegue (front + todos) · Día 2, en paralelo a bloques 5–7

- [ ] `eas.json` con perfil `preview` (APK) ✅ **listo**; falta iniciar sesión en EAS y lanzar `npm run build:apk` (lanzar **temprano**: la cola puede tardar).
- [ ] Definir `EXPO_PUBLIC_API_URL` de producción en el build; verificar que el APK funciona en un dispositivo limpio (instalación desde el link de EAS).
- [ ] Credenciales de acceso para la evaluación: 3 viajeros + 1 moderador (semilla y RPC de promoción ✅ en el script SQL; falta registrar las cuentas y documentarlas junto al link).
- [ ] Plan B del link si EAS falla: APK generado localmente + video de demo + QR de Expo Go (documentar limitación).

### Bloque 7 — Pruebas funcionales de P1 y P2 (front) · Día 2 mediodía

- [ ] Ejecutar la matriz de casos (sección 5) en dispositivo real, en orden, con las cuentas demo.
- [ ] Evidencia por caso: captura o clip + resultado obtenido; guardar en `docs/evidencias-entrega2/`.
- [ ] Registrar incidencias encontradas; corregir solo las que rompan P0 y re-ejecutar.

### Bloque 8 — Documentos de la entrega · Día 2 tarde (en paralelo)

- [ ] **Manual de usuarios** (nuevo): requisitos, instalación (link APK), credenciales demo, guía paso a paso de registro/privacidad, perfil de accesibilidad, mapa y filtros, ruta y navegación, crear reporte, confirmar accesibilidad, consola de moderación, preguntas frecuentes y nota Ley 1581. Exportar a PDF/Word para la entrega.
- [ ] **Diseño, Reutilización y Pruebas** (nuevo): diseño de la app y design system (tokens `theme.ts`, componentes reutilizables, principios de accesibilidad), estrategia de reutilización (catálogo dinámico, servicios tipados, modales compartidos S01/S02), estrategia de pruebas (base `docs/gestion/08`) y **resultados reales** de la ejecución del Bloque 7 con trazabilidad a RNF (11–15, 17, 19, 21–23, 26–29).
- [ ] Revisar C4 y añadir una nota de estado de implementación de P1/P2 si el tiempo lo permite (P1).

### Bloque 9 — Cierre y entrega · Día 2, última hora

- [ ] Checklist final (sección 6) ítem por ítem.
- [ ] Jira al día: estados, comentarios con links a commits/evidencias.
- [ ] Consolidar los 8 entregables en una carpeta/entrada única (recuerda: **entrega un solo integrante**) con: 4 documentos PDF + UI + manual + link APK con credenciales + link Jira.
- [ ] Commit final del repo (código + docs + evidencias) y verificación de que todo está pusheado.

---

## 5. Matriz de pruebas funcionales (mínima y suficiente)

> Ejecutar en dispositivo real con las cuentas demo. Cada caso: precondición → pasos → resultado esperado → obtenido → evidencia → RNF asociado.

### Proceso 1

| # | Caso | Resultado esperado | RNF |
|---|---|---|---|
| P1-01 | Crear reporte con foto y GPS | Fila `reporte` en `PENDIENTE_VALIDACION`; éxito visible en la app | 15, 29 |
| P1-02 | Crear reporte sin conexión momentánea en la subida de foto | El reporte no se pierde; aviso claro; reintento disponible | 17, 19 |
| P1-03 | Confirmar un POI con 3 usuarios distintos | Al 3.º: POI publicado + modal S01 | 18, 23 |
| P1-04 | El autor intenta confirmar su propio reporte | Rechazado con mensaje claro | 28 |
| P1-05 | Un usuario intenta confirmar dos veces | Rechazado con mensaje claro | 28 |
| P1-06 | Moderador rechaza un reporte con motivo | Estado actualizado + motivo registrado; visible en la app | 22, 30 |
| P1-07 | Moderador aprueba directamente un reporte crítico | Publicado aunque no haya consenso | 22 |

### Proceso 2

| # | Caso | Resultado esperado | RNF |
|---|---|---|---|
| P2-01 | Calcular ruta con perfil motriz | Trayecto peatonal + distancia + duración; restricciones enviadas | 21 |
| P2-02 | Perfil sensorial | Restricciones sensoriales enviadas y respetadas | 21 |
| P2-03 | Iniciar navegación paso a paso (U07) | Pasos legibles y navegables con lector de pantalla | 12, 21 |
| P2-04 | Barrera crítica en ruta | Modal S02 + recálculo | 26 |
| P2-05 | Ruta con datos > 60 días | Advertencia visible antes de iniciar | 27 |
| P2-06 | Backend de ruteo caído | Mensaje claro; la app no queda bloqueada | 17 |
| P2-07 | A11y de navegación principal | TalkBack/VoiceOver recorre botones con etiqueta y rol | 11, 12 |

---

## 6. Checklist de entrega (verificar antes de subir)

- [ ] Documento 1: Definición del Proyecto (adjuntar versión vigente).
- [ ] Documento 2: C4 Model (con nota de estado si se alcanzó).
- [ ] Documento 3: Plan de Gestión de la Calidad.
- [ ] Documento 4: Diseño, Reutilización y Pruebas (**nuevo, con resultados reales**).
- [ ] Documento 5: UI (mockups + capturas si hay).
- [ ] Documento 6: Manual de usuarios (**nuevo**).
- [ ] Link de la aplicación desplegada + **credenciales de acceso** (3 viajeros + 1 moderador).
- [ ] Link del proyecto Jira (backlog P1/P2 con estados actualizados).
- [ ] Matriz de pruebas funcionales ejecutada con evidencias adjuntas.
- [ ] Repositorio: `typecheck` + `lint` + `test` en verde, commits pusheados.
- [ ] Un solo integrante realiza la entrega en la plataforma del curso.

---

## 7. Riesgos y planes B

| Riesgo | Prob. | Impacto | Mitigación / Plan B |
|---|---|---|---|
| El SQL de RLS/RPC no se ejecuta a tiempo | Media | Alto (bloquea P1) | Front redacta el script en la primera hora; Datos lo ejecuta en cuanto abra; mientras tanto el front trabaja con los servicios listos y la UI |
| Valhalla no queda accesible desde la nube | Alta | Medio | Demo de ruta en LAN + video; el APK cubre el resto; documentar limitación |
| Build de EAS falla o tarda | Media | Medio | Lanzar el build temprano; plan B: APK local o video + QR Expo Go |
| 3 cuentas para el consenso no existen | Baja | Alto (demo P1) | Semilla de cuentas demo en el script del Día 1 |
| El grafo no soporta `wheelchair` | Media | Medio | Usar `pedestrian` + documentar la deuda de accesibilidad del motor (ADR) |
| Sobrecarga del front (un solo responsable) | Alta | Alto | Timeboxes estrictos (Bloque 4: 3 h máx.), recorte a M03/M05, P1 se cae completo si P0 no está cerrado |
| Pérdida de tiempo en pulido visual | Media | Medio | Congelar estilos a mitad del Día 2; prioridad funcional + accesibilidad básica |

---

## 8. Trazabilidad rápida (entrega ↔ plan)

| Exigencia del PDF | Bloque(s) del plan | Evidencia |
|---|---|---|
| Doc. Diseño, Reutilización y Pruebas | Bloque 8 | Documento + matriz de pruebas |
| Doc. Manual de usuarios | Bloque 8 | Documento PDF |
| Implementar P1 al 100 % | Bloques 0–4 | Demo + evidencia P1-01..07 |
| Implementar P2 al 100 % | Bloque 5 (+backend Jhon) | Demo + evidencia P2-01..07 |
| Desplegar la app | Bloque 6 | Link APK + credenciales |
| Pruebas funcionales P1/P2 | Bloque 7 | Matriz diligenciada + capturas |
| Gestión en Jira | Bloques 0, 9 | Link Jira actualizado |
| Docs 1/2/3/5 (ya existen) | Bloque 9 | Adjuntos en la entrega |
