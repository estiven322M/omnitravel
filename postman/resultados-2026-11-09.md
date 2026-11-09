# Resultados de las pruebas funcionales (Postman/Newman)

- **Fecha:** 9 de noviembre de 2026, 16:47 (hora Colombia)
- **Entorno:** API desplegada en AWS (ECS Express) — `https://om-ea9b9c23afe54514b837ef7dfa228a44.ecs.us-east-2.on.aws`
- **Ejecución:** GitHub Actions → «Pruebas funcionales» n.º 7 (rama `main`, commit `455335a`)
- **Resultado:** 46 solicitudes, 93 aserciones, **0 fallidas**
- **Tiempo de respuesta:** promedio 77 ms · mínimo 18 ms · máximo 725 ms
- **Cálculo de rutas (RNF-01, ≤ 3 s):** 725 ms, 149 ms, 149 ms

Los casos CP-F000 a CP-F005 preparan los datos (usuarios y lugar de prueba); los
40 casos funcionales son CP-F101 a CP-F319. El reporte completo (`newman.json` y
`junit-postman.xml`) queda como artefacto `reporte-postman` de la ejecución.

| Caso | Descripción | HTTP | Tiempo (ms) | Aserciones | Estado |
|---|---|---|---|---|---|
| CP-F000 | Servidor disponible (health) | 200 | 148 | 2/2 | ✅ |
| CP-F001 | Registrar usuario de prueba «autor» | 201 | 296 | 2/2 | ✅ |
| CP-F002 | Registrar usuario de prueba «c1» | 201 | 168 | 2/2 | ✅ |
| CP-F003 | Registrar usuario de prueba «c2» | 201 | 177 | 2/2 | ✅ |
| CP-F004 | Registrar usuario de prueba «c3» | 201 | 170 | 2/2 | ✅ |
| CP-F005 | Elegir un lugar publicado del mapa | 200 | 382 | 2/2 | ✅ |
| CP-F101 | Crear reporte de actualización de un lugar (RF-02) | 201 | 29 | 2/2 | ✅ |
| CP-F102 | Crear lugar nuevo sin nombre → rechazado | 400 | 22 | 2/2 | ✅ |
| CP-F103 | Crear lugar con coordenadas fuera de rango → rechazado | 400 | 23 | 2/2 | ✅ |
| CP-F104 | Crear reporte sin sesión → 401 | 401 | 19 | 1/1 | ✅ |
| CP-F105 | El autor intenta confirmar su propio reporte (RNF-29) | 422 | 23 | 2/2 | ✅ |
| CP-F106 | Primera confirmación (usuario c1) | 201 | 29 | 2/2 | ✅ |
| CP-F107 | Confirmación duplicada del mismo usuario (RNF-07, RNF-29) | 409 | 23 | 2/2 | ✅ |
| CP-F108 | Segunda confirmación (usuario c2) | 201 | 25 | 2/2 | ✅ |
| CP-F109 | Tercera confirmación publica el reporte (RNF-07) | 201 | 34 | 2/2 | ✅ |
| CP-F110 | El reporte vigente del lugar aparece publicado | 200 | 20 | 2/2 | ✅ |
| CP-F111 | Un viajero no puede usar la consola de moderación (RNF-23) | 403 | 22 | 2/2 | ✅ |
| CP-F112 | Denuncia sin motivo válido → 400 (C4) | 400 | 21 | 2/2 | ✅ |
| CP-F113 | El autor no puede denunciar su propio reporte (C4) | 422 | 25 | 2/2 | ✅ |
| CP-F114 | Denunciar un reporte lo envía a moderación (C4, A5) | 201 | 30 | 3/3 | ✅ |
| CP-F115 | Denunciar dos veces el mismo reporte → 409 (C4) | 409 | 22 | 2/2 | ✅ |
| CP-F201 | Ruta para silla de ruedas evitando escaleras (RF-01, RNF-26) | 201 | 725 | 4/4 | ✅ |
| CP-F202 | Ruta para perfil visual (RNF-26) | 201 | 149 | 4/4 | ✅ |
| CP-F203 | Ruta peatonal estándar | 201 | 149 | 4/4 | ✅ |
| CP-F204 | Ruta con coordenada fuera de rango → 400 | 400 | 20 | 1/1 | ✅ |
| CP-F205 | Ruta sin destino → 400 | 400 | 45 | 1/1 | ✅ |
| CP-F206 | Ruta sin sesión → 401 (RNF-21) | 401 | 18 | 1/1 | ✅ |
| CP-F301 | Iniciar la visita al entrar a la navegación (RF-03) | 201 | 54 | 2/2 | ✅ |
| CP-F302 | Calificar una visita que sigue en curso → 409 | 409 | 23 | 2/2 | ✅ |
| CP-F303 | Finalizar la ruta cierra la visita | 200 | 25 | 2/2 | ✅ |
| CP-F304 | La visita aparece como pendiente de calificar (Inicio) | 200 | 21 | 2/2 | ✅ |
| CP-F305 | Calificación fuera de 1–5 → 400 | 400 | 21 | 2/2 | ✅ |
| CP-F306 | Experiencia positiva sin discrepancia (no abre incidencia) | 201 | 30 | 2/2 | ✅ |
| CP-F307 | Calificar dos veces la misma visita → 409 (RNF-19) | 409 | 22 | 2/2 | ✅ |
| CP-F308 | Calificar la visita de otra persona → 404 | 404 | 22 | 2/2 | ✅ |
| CP-F309 | Experiencia sin sesión → 401 (RNF-21) | 401 | 18 | 1/1 | ✅ |
| CP-F310 | La experiencia es pública y no expone datos personales (Ley 1581) | 200 | 21 | 3/3 | ✅ |
| CP-F311 | Segundo viajero inicia su visita | 201 | 26 | 1/1 | ✅ |
| CP-F312 | Segundo viajero finaliza su visita | 200 | 23 | 1/1 | ✅ |
| CP-F313 | Discrepancia abre incidencia y re-verificación; el lugar pasa a revisión (RNF-19) | 201 | 42 | 2/2 | ✅ |
| CP-F314 | El viajero consulta el estado de su incidencia | 200 | 21 | 2/2 | ✅ |
| CP-F315 | Un viajero no puede usar la consola de incidencias (RNF-23) | 403 | 21 | 2/2 | ✅ |
| CP-F316 | Iniciar sesión como moderador | 200 | 259 | 2/2 | ✅ |
| CP-F317 | El moderador ve la incidencia en M06 | 200 | 22 | 2/2 | ✅ |
| CP-F318 | El moderador aprueba la re-verificación: el lugar vuelve a publicarse (Proceso 3 → 1) | 201 | 30 | 2/2 | ✅ |
| CP-F319 | La incidencia quedó resuelta al cerrar el ciclo | 200 | 22 | 2/2 | ✅ |
