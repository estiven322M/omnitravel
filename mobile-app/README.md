# OmniTravel — App Móvil (React Native + Expo)

Adelanto del **Módulo Viajero/Comunidad** de OmniTravel: plataforma colaborativa
de turismo accesible que centraliza, verifica (crowdsourcing) y personaliza la
información de accesibilidad de infraestructura turística.

> **Estado:** MVP navegable (rama `dev_yamis`) con las pantallas U03, U06 y U08
> de los mockups oficiales, datos simulados tipados y ruteo real contra el
> backend (`POST /routes`).

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Expo SDK 57 + React Native 0.86 + TypeScript estricto |
| Navegación | React Navigation 7 (stack + bottom tabs) |
| Estado | Zustand 5 |
| Almacenamiento local | expo-secure-store (perfil, cifrado) + AsyncStorage (disponible) |
| Mapas | react-native-maps + tiles OpenStreetMap (ADR-06) |
| Ubicación | expo-location |
| Pruebas | Jest + jest-expo + React Native Testing Library |
| Calidad | ESLint 9 (flat) + Prettier + `eslint-plugin-triple-rn-a11y` (WCAG) |

## Estructura

Alineada con el árbol del **C4 Nivel 4** (`docs/` del repositorio raíz):

```
mobile-app/
├── App.tsx                  # Punto de entrada (SafeAreaProvider + RootNavigator)
├── src/
│   ├── screens/             # U03 Registro · U06 Mapa · U08 Detalle + stubs (Inicio, Contribuir, Guardados, Perfil)
│   ├── components/          # UI accesible: botones, chips, badges, FilterSheet, PoiCard…
│   ├── navigation/          # Shell de pestañas + stack raíz por estado de sesión
│   ├── services/            # Contratos de datos, mocks (POIs del Quindío), cliente API y ruteo
│   ├── store/               # Perfil de accesibilidad local cifrado (Privacy by Design)
│   ├── utils/               # Tokens de diseño, filtros, formato, polilínea
│   └── assets/              # (assets del template en ./assets)
└── __tests__                # (en src/__tests__) filtros, formato, store, componente
```

## Requisitos y ejecución

- Node.js ≥ 20 y la app **Expo Go** en tu teléfono (Android/iOS).

```bash
cd mobile-app
npm install
cp .env.example .env        # ajusta EXPO_PUBLIC_API_URL si usarás el backend
npx expo start              # escanea el QR con Expo Go
```

> En un dispositivo físico, `EXPO_PUBLIC_API_URL` debe apuntar a la **IP LAN**
> de tu equipo (ej. `http://192.168.1.100:3000`), no a `localhost`.

### Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo Expo |
| `npm run android` / `ios` | Abrir en emulador |
| `npm run lint` | ESLint (incluye reglas de accesibilidad) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest (23 pruebas unitarias) |

## Alcance implementado (mockups → código)

| Pantalla | Estado | Notas |
| --- | --- | --- |
| **U03** Registro y Privacidad | ✅ | Validaciones + perfil de accesibilidad local + aviso Ley 1581 |
| **U05** Filtros de accesibilidad | ✅ | Bottom sheet generado desde el catálogo (motriz/sensorial) |
| **U06** Mapa y Ruteo | ✅ | OSM + POIs mock + ruta real contra `POST /routes` |
| **U08** Detalle del lugar | ✅ | Ficha dinámica por `tipo_valor` + verificación comunitaria |
| Inicio (U04), Contribuir (U09-U10), Guardados, Perfil (U12) | 🔶 Stub | Llegan en la siguiente iteración |

## Decisiones clave

- **React Navigation + árbol C4** en lugar de Expo Router: mantiene la
  trazabilidad documento ↔ código del equipo (nota: `AGENTS.md` del template
  sugiere Expo Router; se priorizó la arquitectura del proyecto).
- **Mapas OSM vía `react-native-maps`** detrás de la capa `services/api`
  (funciona en Expo Go sin API key; migrable a Mapbox, ADR-06).
- **Perfil de accesibilidad 100 % local** en `expo-secure-store` (AES-256 del
  sistema): nunca se envía al backend (ADR-09, Ley 1581, RNF-07/08).
- **Mocks tipados con la forma de los contratos reales** (POI, GeoJSON del
  `MapController`, catálogo de características) para conectar endpoints sin
  refactor.

## Accesibilidad (RNF-11/12/13/14)

- Etiquetas, roles y estados en todos los interactivos (TalkBack/VoiceOver).
- Áreas táctiles ≥ 44 px; contraste WCAG 2.1 AA validado en los tokens.
- Anuncios: región viva en Android + `announceForAccessibility` en iOS
  (sin doble lectura).
- Perfil configurable en una sola pantalla (≤ 3 pantallas / 5 interacciones).
- Lint con reglas de accesibilidad (`eslint-plugin-triple-rn-a11y`).

## Autenticación

- La app no se conecta a la base de datos: llama al backend (`src/services/api/auth.ts`),
  que guarda la cuenta en PostgreSQL (AWS RDS, tabla `usuario`).
- `POST /auth/register` y `POST /auth/login` reciben `{ email, password }` y devuelven
  un JWT, que se guarda cifrado con `expo-secure-store`.
- El backend hashea la contraseña con bcrypt y asigna el rol `viajero`.
- El perfil de accesibilidad sigue siendo 100 % local (no se envía al backend).

## Notas para el equipo (backend / siguientes pasos)

1. `POST /routes` usa `costing: 'auto'`; para OmniTravel corresponde
   `wheelchair` / `pedestrian` de Valhalla.
2. Endpoints pendientes que el front ya consume como mocks tipados:
   `MapController` (bbox → GeoJSON), reportes, subida de
   evidencias (S3).
3. `docs/adr/` del repositorio está vacío; los ADR-01…09 del documento C4
   pueden poblarse allí.
4. Verificación manual en Expo Go pendiente (U03 → U06 → U08).
