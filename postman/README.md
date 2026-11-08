# Pruebas funcionales con Postman

`omnitravel.postman_collection.json` tiene las pruebas funcionales de los tres
procesos de OmniTravel. Por defecto apuntan al backend desplegado en Railway.

| Carpeta | Casos | Qué valida |
|---|---|---|
| 0. Preparación | CP-F000 a CP-F005 | Que el servidor responde, crea 4 usuarios de prueba y elige un lugar publicado |
| Proceso 1 — Validación colaborativa | CP-F101 a CP-F111 (11) | Crear un reporte, rechazar datos inválidos, consenso de 3, autoconfirmación, duplicados y permisos de moderación |
| Proceso 2 — Rutas accesibles | CP-F201 a CP-F206 (6) | Rutas para silla de ruedas, perfil visual y peatonal; tiempo ≤ 3 s; coordenadas inválidas; uso sin sesión |
| Proceso 3 — Retroalimentación post-viaje | CP-F301 a CP-F314 (14) | Experiencia positiva, duplicado en 24 h, validaciones, discrepancia que abre incidencia, gravedad, permisos y atención del moderador en M06 (re-verificación) |

## Cómo ejecutarla

1. En Postman, usa **Import** y elige el archivo `omnitravel.postman_collection.json`.
2. Sobre la colección, haz clic en **Run collection** y luego en **Run**. No cambies el orden: cada caso usa datos del anterior.
3. Para los casos del moderador (CP-F312 a CP-F314), en la pestaña **Variables** de la colección escribe `email_moderador` y `clave_moderador` (no las guardes en el repositorio). Sin ellas esos tres casos se omiten.
4. Al terminar, toma la captura del resumen, donde aparecen los casos aprobados y fallidos. Esa captura es la evidencia para el documento.

Desde la terminal también se puede ejecutar así:

```powershell
npx newman run postman/omnitravel.postman_collection.json \
  --env-var "email_moderador=CORREO" --env-var "clave_moderador=CLAVE"
```

Cada ejecución crea 4 cuentas de prueba (`postman+…@omnitravel.test`). También crea un reporte de actualización sobre un lugar que ya está publicado, así que no aparecen lugares nuevos en el mapa. El Proceso 3 deja tres experiencias marcadas con «[Postman]» y dos incidencias en M06.

Para probar contra el backend local, cambia la variable `baseUrl` de la colección a `http://localhost:3000`.
