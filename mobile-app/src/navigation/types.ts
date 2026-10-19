import type { NavigatorScreenParams } from '@react-navigation/native';

/** Pestañas del módulo Viajero/Comunidad (shell del MVP). */
export type MainTabParamList = {
  Inicio: undefined;
  Mapa: { destinoPoiId?: string } | undefined;
  Contribuir: undefined;
  Guardados: undefined;
  Perfil: undefined;
};

/** Pestañas del panel de moderación (mockups M02–M07). */
export type ModeradorTabParamList = {
  InicioModerador: undefined;
  ReportesModerador: undefined;
  Mapa: { destinoPoiId?: string } | undefined;
  Estadisticas: undefined;
  PerfilModerador: undefined;
};

/** Stack raíz: cuenta (U01–U03, M01), pestañas y pantallas de detalle. */
export type RootStackParamList = {
  /** U01 — Presentación. */
  Splash: undefined;
  /** U02 — Inicio de sesión (con selector Usuario / Moderador). */
  Login: undefined;
  /** U03 — Registro y privacidad. */
  Registro: undefined;
  Principal: NavigatorScreenParams<MainTabParamList> | undefined;
  /** M02–M07 — Panel de moderación (solo moderador/administrador). */
  PanelModerador: NavigatorScreenParams<ModeradorTabParamList> | undefined;
  /** M04/M05 — Revisión de un reporte (el reporte viaja en moderacionStore). */
  RevisionReporte: undefined;
  /** M06 — Incidencias post-viaje (Proceso 3). */
  Incidencias: undefined;
  /** U11 — Notificaciones. */
  Notificaciones: undefined;
  DetallePoi: { poiId: string };
  /** Mis reportes (U12): historial propio con estado de validación. */
  MisReportes: undefined;
  /** Navegación paso a paso (U07) con el origen ya resuelto. */
  Navegacion: { poiId: string; origenLat: number; origenLon: number };
};
