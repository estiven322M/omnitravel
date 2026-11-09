# ADR-01: Canal del cliente: aplicación móvil multiplataforma (React Native + Expo)

- **Estado:** Aceptada e implementada
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
Viajeros, colaboradores y moderadores usan el sistema en la calle, con GPS, cámara y lectores de pantalla (TalkBack/VoiceOver).

## Decisión
Una sola app React Native con Expo (SDK 57) para Android e iOS, que además se exporta como versión web (`expo export -p web`).

## Alternativas consideradas
Apps nativas separadas (Kotlin/Swift); solo web.

## Justificación
Un único código base; acceso a sensores y a la accesibilidad nativa; la web sirve para demostraciones y moderación de escritorio.

## Consecuencias
APK de Android con EAS Build; la web se publica en AWS Amplify. iOS nativo no se distribuye en esta entrega.

## Evidencia en el repositorio
`mobile-app/`, `eas.json`, job «App móvil» del CI.
