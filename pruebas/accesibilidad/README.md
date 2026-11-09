# Auditoría automática de accesibilidad (WCAG 2.1 AA)

Recorre 11 pantallas de la versión web (viajero y moderador) con Chromium y
ejecuta **axe-core** con las reglas WCAG 2.0/2.1 nivel A y AA: contraste de
color, nombres accesibles, roles y estados ARIA, etiquetas de formularios,
estructura de listas y pestañas. Responde al RNF-11/RNF-12 del Plan de Calidad
y al riesgo 11 de la auditoría.

La API se simula con datos de ejemplo, así que la prueba es repetible y no
toca la base de producción. Corre en cada PR (CI → job «App móvil») y falla
si aparece una violación grave (*serious* o *critical*).

```bash
cd mobile-app && npx expo export -p web          # genera dist/
cd ../pruebas/accesibilidad
npm ci && npx playwright install chromium
npm run auditar -- --dist ../../mobile-app/dist
```

Resultados en `resultados/`: `informe.md` (tabla por pantalla), `axe.json`
(detalle completo) y una captura por pantalla.

## Alcance y límites

axe-core detecta automáticamente cerca de la mitad de los problemas WCAG. No
reemplaza la prueba manual con lector de pantalla (TalkBack en Android,
VoiceOver en iOS) ni la prueba con personas con discapacidad; esas se
registran con los formatos de `docs/gestion/formatos/`.
