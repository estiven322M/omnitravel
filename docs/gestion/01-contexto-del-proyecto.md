# 01. Contexto del proyecto OmniTravel

## Propósito
OmniTravel es un ecosistema digital colaborativo de turismo accesible. Centraliza, verifica mediante crowdsourcing y personaliza la información de accesibilidad de la infraestructura turística (POI: puntos de interés como hoteles, restaurantes, museos y atractivos), permitiendo a personas con discapacidad motriz y sensorial planificar sus desplazamientos con autonomía y confianza. Resuelve la incertidumbre de la información "falsamente accesible" y mantiene la vigencia de los datos mediante un ciclo de retroalimentación post-viaje.

## Actores y roles técnicos
- `VIAJERO_ADI`: viajero con discapacidad (motriz o sensorial). Configura su perfil de accesibilidad, consulta el mapa, solicita rutas y registra retroalimentación post-viaje.
- `COLABORADOR`: colaborador comunitario (con o sin discapacidad) que aporta reportes de accesibilidad de lugares que visita.
- `ESTABLECIMIENTO`: hotel, restaurante o atractivo turístico que registra o confirma la información de accesibilidad de su propio local.
- `MODERADOR`: audita reportes, gestiona incidencias críticas, resuelve discrepancias comunitarias y aplica reglas de calidad de datos geoespaciales. Accede al Módulo Administrador/Moderador con credenciales corporativas `@omnitravel.edu.co`.
- `ADMIN`: administración general de la plataforma, políticas de privacidad y seguridad de datos sensibles. Comparte el módulo de moderación.

> Nombres de roles del contrato: `VIAJERO_ADI`, `COLABORADOR`, `ESTABLECIMIENTO`, `MODERADOR`, `ADMIN`. La discrepancia con el esquema Supabase compartido (roles de transporte) quedó resuelta: la BD en AWS RDS usa el catálogo `rol` de OmniTravel (viajero, colaborador, establecimiento, moderador, administrador).

## Plataforma y arquitectura
- Cliente único multirol: aplicación móvil React Native (Expo SDK 57) para iOS/Android, con Módulo Viajero/Comunidad y Módulo Administrador/Moderador segmentados por rol (pantallas U01–U12, M01–M07, modales S01/S02).
- Backend: NestJS con API REST versionada bajo `/api/v1`; procesa reglas de negocio, consenso comunitario y ruteo accesible.
- Persistencia: PostgreSQL 17 con PostGIS 3.5 (geoespacial, SRID 4326, índices GIST). Infraestructura local en `docker-compose.yml` (`omnitravel-postgres`, puerto 5432).
- Motor de ruteo: Valhalla auto-hospedado en Docker (`omnitravel-valhalla`, puerto 8002), invocado por el backend; el cliente móvil jamás llama a Valhalla directamente. Hoy el backend usa `costing: 'auto'`; corresponde `pedestrian`/`wheelchair` con reglas de barreras (pendiente de incorporar).
- Autenticación: JWT emitido por el backend NestJS (cuentas en la tabla `usuario` de la BD en AWS RDS, contraseñas bcrypt), conforme al C4/RNF-21. La sesión se almacena cifrada en el dispositivo (expo-secure-store).
- Datos sensibles del perfil de accesibilidad: se almacenan exclusivamente en el dispositivo (Async Storage / Secure Storage); el backend no persiste diagnósticos ni tipo/grado de discapacidad (RNF-22).
- Servicios externos: Mapbox/OpenStreetMap (cartografía base), AWS S3 (evidencia fotográfica), servicio de notificaciones push.

## Alcance respaldado por los entregables del curso
- Definición del Proyecto: procesos 1 (Validación Colaborativa de Infraestructura con consenso de 3 confirmaciones), 2 (Rutas Accesibles Personalizadas) y 3 (Retroalimentación e Incidencias Post-Viaje).
- Modelo C4 (N1–N4): app móvil multirol, backend core, PostgreSQL+PostGIS, Valhalla/pgRouting, S3 y sistemas base de mapas.
- UI Mockups: U01–U12 (comunidad), M01–M07 (moderación), S01 (Consenso Alcanzado) y S02 (Alerta de Peligro en Ruta).
- Plan de Gestión de la Calidad: RNF-01 a RNF-30.

## Exclusiones documentadas
- Construcción o modificación física de infraestructura urbana (rampas, semáforos sonoros, etc.).
- Reservas o pagos de servicios turísticos (hoteles, restaurantes, tours).
- Optimización de rutas vehiculares (el alcance es exclusivamente peatonal).

## Discrepancias a resolver
1. El proyecto Supabase compartido expone una tabla `usuarios` con campos de transporte (viaje, parada, asiento, abordo) y roles ajenos al dominio (`estudiante`, `pasajero`, `superadmin`). OmniTravel requiere su propio esquema o une proyecto separado; el MER de este paquete es la propuesta para ese esquema. **Resuelto (2026-10-18):** la BD de OmniTravel es PostgreSQL + PostGIS en AWS RDS (`omnitravel_db`) con esquema propio, y la app ya no usa Supabase.
2. El backend consume Valhalla con `costing: 'auto'`; el requisito (RNF-26, RNF-26) exige rutas peatonales que excluyan barreras críticas. Definir el perfil de ruteo y el mecanismo de exclusión de segmentos con barreras antes de avanzar.
3. El modelo físico del diseño de BD declara 16 tablas; validar la propuesta del documento 04 contra ese modelo cuando esté disponible.
4. El catálogo de notificaciones push (U11) no tiene contrato aprobado; no implementar endpoints de notificaciones hasta aprobarlo.

## Fuentes de verdad y precedencia
1. Requisitos aprobados y decisiones de arquitectura (Definición del Proyecto, C4, ADRs).
2. Plan de Gestión de la Calidad para valores de RNF (fórmulas y criterios normativos).
3. UI Mockups para pantallas, flujos y catálogos visuales.
4. `openapi.yaml` (cuando se apruebe) para rutas, métodos, esquemas, permisos y códigos de error.
5. Modelo físico del diseño de BD y entidades del backend para la estructura de persistencia.
6. Código actual para el estado implementado.

Si estas fuentes difieren, no inventar una conciliación: registrar la discrepancia y solicitar una decisión del equipo.

## Convenciones de idioma
El texto de presentación al usuario, el catálogo de características y los mensajes de error (`message`) deben estar en español. Las nomenclaturas técnicas nuevas (módulos del backend, códigos de error, props de contrato API) deben estar en inglés; el código existente de la app móvil usa nomenclatura en español (p. ej. `calcularRutaAccesible`, `CatalogoCaracteristicas`) y se conserva para no introducir deuda de refactor: los módulos nuevos siguen la convención del código circundante. El cliente debe decidir con `code` de error, nunca analizando `message`.
