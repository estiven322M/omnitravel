# Pruebas funcionales con Postman

`omnitravel.postman_collection.json` tiene las pruebas funcionales de los dos
procesos de la entrega 2. Por defecto apuntan al backend desplegado en Railway.

| Carpeta | Casos | Qué valida |
|---|---|---|
| 0. Preparación | PF-000 a PF-005 | Que el servidor responde, crea 4 usuarios de prueba y elige un lugar publicado |
| Proceso 1 — Validación colaborativa | PF-101 a PF-111 (11) | Crear un reporte, rechazar datos inválidos, consenso de 3, autoconfirmación, duplicados y permisos de moderación |
| Proceso 2 — Rutas accesibles | PF-201 a PF-206 (6) | Rutas para silla de ruedas, perfil visual y peatonal; tiempo ≤ 3 s; coordenadas inválidas; uso sin sesión |

## Cómo ejecutarla

1. En Postman, usa **Import** y elige el archivo `omnitravel.postman_collection.json`.
2. Sobre la colección, haz clic en **Run collection** y luego en **Run**. No cambies el orden: cada caso usa datos del anterior.
3. Al terminar, toma la captura del resumen, donde aparecen los casos aprobados y fallidos. Esa captura es la evidencia para el documento.

Desde la terminal también se puede ejecutar así:

```powershell
npx newman run postman/omnitravel.postman_collection.json
```

Cada ejecución crea 4 cuentas de prueba (`postman+…@omnitravel.test`). También crea un reporte de actualización sobre un lugar que ya está publicado, así que no aparecen lugares nuevos en el mapa.

Para probar contra el backend local, cambia la variable `baseUrl` de la colección a `http://localhost:3000`.
