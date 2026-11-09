# 03. Requisitos no funcionales (RNF)

> **Numeración única (auditoría 7.3):** la fuente normativa es el cuerpo del **Plan de Gestión de la Calidad**, sección 4 (ISO/IEC 25010). Esta tabla, el documento de Diseño y Pruebas, el código, la colección de Postman y los casos de TestRail usan esa misma numeración RNF-01 a RNF-30. Las métricas y criterios de aceptación completos están en el Plan.

| ID | Característica ISO/IEC 25010 | Requisito |
|---|---|---|
| RNF-01 | Eficiencia de desempeño | Rendimiento en cálculo de rutas accesibles |
| RNF-02 | Eficiencia de desempeño | Latencia del motor de ruteo bajo carga concurrente |
| RNF-03 | Eficiencia de desempeño | Tiempo de respuesta en moderación comunitaria |
| RNF-04 | Eficiencia de desempeño | Tiempo de carga y renderizado del mapa interactivo |
| RNF-05 | Eficiencia de desempeño | Velocidad de cierre del ciclo de re-verificación |
| RNF-06 | Fiabilidad | Disponibilidad continua del backend geoespacial |
| RNF-07 | Fiabilidad | Precisión del quórum de consenso colaborativo |
| RNF-08 | Fiabilidad | Cobertura de pruebas unitarias y de integración |
| RNF-09 | Fiabilidad | Tolerancia a fallos por contingencia de cartografía externa |
| RNF-10 | Fiabilidad | Tasa de reincidencia de incidencias resueltas |
| RNF-11 | Capacidad de interacción | Conformidad con pautas de accesibilidad WCAG 2.1 Nivel AA |
| RNF-12 | Capacidad de interacción | Compatibilidad con lectores de pantalla (TalkBack y VoiceOver) |
| RNF-13 | Capacidad de interacción | Simplicidad y baja tasa de abandono en reportes de post-viaje |
| RNF-14 | Capacidad de interacción | Participación comunitaria en retroalimentación |
| RNF-15 | Capacidad de interacción | Satisfacción general de los usuarios post-viaje |
| RNF-16 | Adecuación funcional | Cobertura de infraestructura accesible catalogada |
| RNF-17 | Adecuación funcional | Participación activa de establecimientos turísticos |
| RNF-18 | Adecuación funcional | Precisión de la geolocalización de inicio de ruta |
| RNF-19 | Adecuación funcional | Pertinencia en escalamiento a re-verificación |
| RNF-20 | Adecuación funcional | Efectividad en la resolución y actualización cartográfica |
| RNF-21 | Seguridad | Autenticación y autorización basada en tokens JWT |
| RNF-22 | Seguridad | Cifrado y minimización de datos sensibles de discapacidad |
| RNF-23 | Seguridad | Control de acceso basado en roles (RBAC) |
| RNF-24 | Seguridad | Cifrado en tránsito de comunicaciones de red |
| RNF-25 | Seguridad | Expiración y renovación segura de sesiones |
| RNF-26 | Protección | Exclusión de tramos viales con riesgo físico para movilidad reducida |
| RNF-27 | Protección | Alertas preventivas ante información no confirmada o en litigio |
| RNF-28 | Protección | Validación estricta y saneamiento de archivos de evidencia |
| RNF-29 | Protección | Blindaje contra manipulación coordinada del consenso |
| RNF-30 | Protección | Pista de auditoría inmutable para acciones de moderación |

## Correspondencia con la numeración anterior

Versiones previas del repositorio y del documento de Diseño usaban la numeración del índice antiguo del Plan. Todas las referencias se migraron así:

| Anterior | Tema | Ahora |
|---|---|---|
| RNF-01 | Tiempo de cálculo de ruta | RNF-01 |
| RNF-02 | Carga del mapa | RNF-04 |
| RNF-03 | Subida de evidencia | RNF-28 |
| RNF-04 | Consultas geoespaciales concurrentes | RNF-02 |
| RNF-05 | Procesamiento de moderación | RNF-03 |
| RNF-06 | Autenticación JWT | RNF-21 |
| RNF-07 | Cifrado de datos sensibles | RNF-22 |
| RNF-08 | Expiración de tokens | RNF-25 |
| RNF-09 | Control de acceso por roles | RNF-23 |
| RNF-10 | Comunicación cifrada | RNF-24 |
| RNF-11 | Pautas WCAG | RNF-11 |
| RNF-12 | Lectores de pantalla | RNF-12 |
| RNF-13 | Configuración simple del perfil | RNF-13 |
| RNF-14 | Retroalimentación multisensorial | RNF-12 |
| RNF-15 | Formularios simplificados | RNF-13 |
| RNF-16 | Disponibilidad del backend | RNF-06 |
| RNF-17 | Tolerancia a fallos del ruteo | RNF-09 |
| RNF-18 | Validación por consenso | RNF-07 |
| RNF-19 | Recuperación ante caída del almacenamiento | RNF-09 |
| RNF-20 | Consistencia tras re-verificación | RNF-05 |
| RNF-21 | Rutas evitando barreras | RNF-26 |
| RNF-22 | Ciclo de publicación completo | RNF-20 |
| RNF-23 | Regla de consenso | RNF-07 |
| RNF-24 | Retroalimentación tras finalizar | RNF-19 |
| RNF-25 | Escalamiento de incidencias | RNF-19 |
| RNF-26 | Prevención de rutas con riesgo | RNF-26 |
| RNF-27 | Advertencia de información no verificada | RNF-27 |
| RNF-28 | Protección ante manipulación del consenso | RNF-29 |
| RNF-29 | Validación de archivos | RNF-28 |
| RNF-30 | Auditoría de moderación | RNF-30 |
