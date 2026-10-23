# OmniTravel en TestRail

Esta carpeta tiene lo necesario para gestionar las pruebas de la entrega final en
[TestRail](https://www.testrail.com/).

| Archivo | Para qué sirve |
|---|---|
| `omnitravel_casos_testrail.csv` | Los 128 casos de los dos procesos: 111 unitarios (Jest) y 17 funcionales (Postman) |

## 1. Crear el proyecto

1. Entra a tu cuenta de TestRail y ve a **Administration → Projects → Add Project**.
2. Ponle el nombre **OmniTravel**.
3. En el tipo de suite elige **Use a single repository for all cases**.

## 2. Importar los casos

1. Abre el proyecto y ve a **Test Cases → Import Cases → Import from CSV**.
2. Elige `omnitravel_casos_testrail.csv`. La codificación es UTF-8.
3. En el formato elige **Test case (Text)**: cada caso trae sus pasos en un solo campo.
4. Activa la opción **Section** y escribe ` > ` como separador de jerarquía. Así se crean solas las secciones:
   - Proceso 1 - Validación colaborativa de infraestructura
     - Pruebas unitarias (Jest) → Backend / App móvil → una sección por archivo
     - Pruebas funcionales (Postman)
   - Proceso 2 - Planificación de rutas accesibles personalizadas (con la misma estructura)
5. Relaciona las columnas así: `Title`, `Type`, `Priority`, `References`, `Preconditions`, `Steps` y `Expected Result`.
6. `Automation Type` es opcional. Si quieres conservarla, primero créala como campo personalizado de tipo texto en **Administration → Customizations**.

## 3. Crear el plan de ejecución

1. Ve a **Milestones → Add Milestone** y crea el hito **Entrega final**.
2. Ve a **Test Runs & Results → Add Test Run**. Crea un run por tipo de prueba, todos ligados al hito:
   - **Run 1 – Unitarias**: elige las secciones de Pruebas unitarias.
   - **Run 2 – Funcionales API**: elige las secciones de Pruebas funcionales.
3. Registra cada resultado como **Passed**, **Failed**, **Blocked** o **Retest**. Cuando un caso falle, adjunta la captura y crea el defecto.

## 4. Subir resultados automáticamente desde la CI (opcional)

El flujo de CI genera reportes JUnit: `junit-backend.xml`, `junit-app.xml` y `junit-postman.xml`. TestRail los recibe con su herramienta oficial **trcli**:

```bash
pip install trcli
trcli -y -h https://TU-EMPRESA.testrail.io --project "OmniTravel" \
  --username TU_CORREO --key TU_API_KEY \
  parse_junit --title "CI $(date +%F)" -f backend/reports/junit-backend.xml
```

La API key se genera en TestRail, en **My Settings → API Keys**. Si guardas `TESTRAIL_URL`, `TESTRAIL_USER` y `TESTRAIL_KEY` como secretos del repositorio, el job **TestRail** de la CI sube los resultados solo en cada ejecución de `main`.
