# 00. Checklist de aprobación del equipo

Guion corto para cerrar el paso documental antes de mover la carpeta `gestion/` al repositorio del proyecto. Marca cada ítem cuando el equipo lo apruebe (o registre la corrección pedida).

## 1. Contrato API — `openapi.yaml` (borrador 0.1.0)
- [ ] Validar el YAML (debe parsear sin errores) y leerlo junto con `07-contrato-api.md`.
- [ ] Confirmar las rutas y el prefijo `/api/v1` (inventario del documento 07).
- [ ] Confirmar roles y qué queda público: registro, login y (decisión) la consulta del mapa.
- [ ] Confirmar la forma de `Poi`, `ValorAccesibilidad` y la respuesta de `/routes` (compatible con Valhalla + `warnings[]`).
- [ ] Confirmar los códigos de error de la lista `Error.code` (06/07).
- Al aprobarse: quitar `x-status: BORRADOR`, subir versión y desde entonces el archivo es fuente normativa.

## 2. Modelo de datos — `04-modelo-entidad-relacion.md`
- [ ] **En pausa**: el equipo lo revisará después. Mientras tanto, ninguna implementación debe tomarlo como norma.
- Nota para esa revisión: validar contra el modelo físico de 16 tablas (resuelto: la BD está en AWS RDS).

## 3. Decisiones pendientes (bloquean fases del plan 10)
- [ ] Contrato de notificaciones push (U5/U11) — sin él, no se implementa `notifications`.
- [x] BD propia para OmniTravel: PostgreSQL + PostGIS en AWS RDS (`omnitravel_db`); Supabase retirado.
- [ ] Perfil de ruteo de Valhalla (migrar `costing: 'auto'` → peatonal accesible + lógica de barreras).
- [ ] Límite de tamaño y tipos de evidencia para S3 (RNF-28).
- [ ] Consulta del mapa pública o autenticada.

## 4. Repositorio
- [ ] La configuración de infraestructura local **no se sube a GitHub**: `docker-compose.yml` (con credenciales de BD), `.env` y los datos generados de Valhalla están en `.gitignore`.
- [ ] Al clonar/copyar: mover la carpeta `gestion/` completa (con `adr/` y `openapi.yaml`) a `docs/` del repositorio destino; la estructura es autocontenida (rutas relativas internas).

## 5. Criterios de documentación
- [ ] Item marcado significa: discutido en equipo, decidido y registrado (en ADR si toca). Lo que no quede aprobado queda como propuesta, no como norma.
