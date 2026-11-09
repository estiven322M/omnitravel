# 02. Requisitos funcionales

> Propuesta derivada de la Definición del Proyecto (procesos 1–3), los UI Mockups (U01–U12, M01–M07, S01–S02) y el estado del código actual (app Expo con mocks tipados y `POST /routes`). Los identificadores son propuestos; cuando exista una matriz oficial de requisitos del curso, se sustituyen por aquellos IDs y este documento pasa a resumir el contrato. Marcar [PENDIENTE] lo que requiera aprobación del equipo.

## Usuarios y perfiles (U)
- `U1`: registrar cuenta (viajero con discapacidad, colaborador comunitario o establecimiento turístico) con aceptación obligatoria de la política de tratamiento de datos (Ley 1581 de 2012). El registro se hace en el backend (`POST /auth/register`), que guarda la cuenta en la BD de AWS RDS.
- `U2`: autenticación por correo/credenciales devolviendo JWT; la sesión se guarda cifrada en el dispositivo (expo-secure-store) con expiración máxima de 24 horas (RNF-25). Los moderadores usan dominio corporativo `@omnitravel.edu.co` (M01), que activa el Módulo Administrador/Moderador.
- `U3`: consultar perfil propio (datos no sensibles) y cerrar sesión.
- `U4`: configurar el perfil de accesibilidad (tipo de discapacidad: motriz o sensorial, preferencias de filtro y necesidades) en un flujo simple (≤ 3 pantallas / 5 interacciones, RNF-13). Los datos de tipo/grado de discapacidad solo se guardan en el dispositivo (RNF-22); el backend recibe únicamente parámetros de restricción anónimos para las rutas.
- `U5`: notificaciones de la app (U11): cambios de estado de reportes y alertas de ruta. Catálogo de eventos, persistencia y reintentos [PENDIENTE: no implementar sin contrato].
- `U6`: perfil y gamificación del colaborador (U12): estadísticas de aporte (reportes enviados, confirmaciones, pulso comunitario).

## POI y mapa (P)
- `P1`: consultar la capa geográfica del mapa con un llamado por *bounding box* que devuelva GeoJSON (pantalla U06). Mientras el backend no expone `MapController`, el mapa consume mocks tipados con la forma definitiva del contrato.
- `P2`: buscar y filtrar POI por categoría y por características de accesibilidad ancho de puerta, rampa, ascensor, escaleras, baño adaptado, semáforo sonoro, piso podotáctil, braille; los filtros se reúsen con el perfil del usuario (U04–U05).
- `P3`: consultar el detallado de un POI: ficha de accesibilidad con valores vigentes por característica, estado de verificación (`PENDIENTE`, `EN_REVISION`, `VERIFICADO`), confirmaciones comunitarias, fecha de última verificación y experiencias (U08).
- `P4`: el feed de inicio por defecto muestra POI del Quindío (Armenia) priorizados por el perfil del usuario (U04).
- `P5`: el detalle solo expone características del catálogo de accesibilidad; el backend no expone datos sensibles del viajero (RNF-22).
- [PENDIENTE] Historial de verificación del POI (quién reportó/confirmó, sin exponer datos personales).

## Crowdsourcing de reportes (C) — Proceso 1
- `C1`: capturar y crear un POI con evidencia: fotografías (AWS S3, con reintentos RNF-09), coordenadas GPS y formulario con características del catálogo (U09–U10). Todo reporte nuevo entra en estado `PENDIENTE_VALIDACION`.
- `C2`: la carga de evidencia fotográfica debe validar tipo MIME y tamaño máximo en el backend antes de guardar en S3 (RNF-28).
- `C3`: confirmar la accesibilidad de un POI por parte de la comunidad (modal S01). Al acumular 3 confirmaciones de usuarios distintos, el estado pasa a `PUBLICADO` y aparece en la capa pública (RNF-07/RNF-07). Un usuario no puede confirmar su propio reporte ni confirmar dos veces el mismo POI (RNF-29). Se aplican transacción y bloqueo para no publicar por duplicado bajo concurrencia.
- `C4`: denunciar un reporte o POI por falsedad/spam; la denuncia activa la vía B de moderación (M03/M04).
- `C5`: los reportes con alertas de barrera crítica o incongruencias severas de coordenadas GPS se excluyen de la vía A y van directo a revisión del moderador (M04).
- `C6`: el estado del POI tras una solicitud de re-verificación debe reflejar "en revisión" (`EN_REVISION`) hasta que se confirme el nuevo estado (RNF-05).

## Rutas accesibles (RT) — Proceso 2
- `RT1`: solicitar una ruta peatonal accesible: el backend invoca Valhalla y devuelve trayecto paso a paso, distancia, duración y geometría; el cálculo debe excluir segmentos marcados como barrera crítica para el perfil del usuario (RNF-26/RNF-26) en ≤ 3 s en el 95% de las solicitudes (RNF-01).
- `RT2`: visualizar trayecto y alternativas, e iniciar la navegación paso a paso (U06–U07).
- `RT3`: alertar al usuario ante barreras o reportes críticos durante la navegación (modal S02) con recálculo dinámico de la ruta.
- `RT4`: advertir antes de iniciar la navegación si un tramo pasa por datos de accesibilidad desactualizados (más de 60 días) o no verificados (RNF-27).
- `RT5`: ante un fallo del motor de ruteo, informar al usuario con un mensaje claro y ofrecer alternativa; nunca fallar en silencio (RNF-09).

## Retroalimentación e incidencias (F) — Proceso 3
- `F1`: solicitar retroalimentación solo tras la finalización confirmada del trayecto o visita, evitando solicitudes fuera de contexto (RNF-19).
- `F2`: registrar calificación (1–5) y comentario como experiencia del viajero sobre el POI (tabla RETROALIMENTACION); retroalimentación multisensorial de confirmación (RNF-12).
- `F3`: detectar discrepancia entre la experiencia registrada y la información publicada, y generar automáticamente una solicitud de re-verificación trazable hacia el Proceso 1 (RNF-19).
- `F4`: consultar las experiencias registradas de un POI (se muestra en el detallado, U08).

## Moderación y administración (A) — Módulo M01–M07
- `A1`: la decisión del moderador es ejecutiva y sobreescribe cualquier estado del consenso comunitario (aprobación/rechazo directo, M04–M05); el sistema queda sin estados intermedios indefinidos (RNF-20).
- `A2`: dashboard de incidencias y estadísticas del sistema (M02).
- `A3`: lista de reportes con filtros por estado (M03).
- `A4`: resolver reportes con alertas de seguridad/barreras críticas o incongruencias severas de coordenadas GPS (M04), y aprobar o rechazar con motivo (M05).
- `A5`: atender denuncias de la comunidad por falsedad o spam.
- `A6`: gestionar incidencias post-viaje y solicitudes de re-verificación (M06), resolviendo el ciclo y devolviendo al POI su estado de verificación correspondiente.
- `A7`: perfil y estadísticas de moderador (M07).
- `A8`: registrar auditoría inmutable de toda acción de moderación (quién, cuándo, qué) (RNF-30); los roles MODERADOR/ADMIN tienen acceso exclusivo a este módulo (RNF-23).
- [PENDIENTE] Gestión de catálogo de características y configuración del umbral de consenso por parte de ADMIN.

## Independencia de la vía de publicación
Los flujos C1→C3 (consenso comunitario automático) y A1–A6 (auditoría moderadora) deben ser independientes: el moderador no valida los reportes ordinarios, pero su decisión sobre los excepcionales es inmediata y prevalece sobre el consenso.

## Exclusiones del alcance funcional
No implementar reservas/pagos turísticos, rutas vehiculares ni gestión física de infraestructura (ver documento 01).
