# ADR-09: Datos sensibles solo en el dispositivo y autenticación JWT

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
El perfil de discapacidad es un dato sensible (Ley 1581); la app debe identificar el rol en cada petición.

## Decisión
El perfil vive solo en el cliente: Keychain/Keystore en el teléfono y, en la web, cifrado AES-GCM con llave no exportable en IndexedDB (sin Web Crypto no se guarda). El servidor guarda solo la cuenta (correo, hash bcrypt, rol). Sesión con JWT de 24 h; el rol se verifica en la base en cada operación sensible.

## Alternativas consideradas
Perfil en el servidor; cookies de sesión; solo proveedor externo de identidad.

## Justificación
Minimiza datos sensibles en el servidor y funciona sin estado en la API.

## Consecuencias
El documento C4 titulaba este ADR solo como «JWT»: se corrige el título. Inicios de sesión y cambios de rol quedan auditados.

## Evidencia en el repositorio
`mobile-app/src/services/almacenamiento*.ts`, `backend/src/auth/`, CP-I04.
