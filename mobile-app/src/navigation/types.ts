import type { NavigatorScreenParams } from '@react-navigation/native';

/** Pestañas del módulo Viajero/Comunidad (shell del MVP). */
export type MainTabParamList = {
  Inicio: undefined;
  Mapa: { destinoPoiId?: string } | undefined;
  Contribuir: undefined;
  Guardados: undefined;
  Perfil: undefined;
};

/** Stack raíz: flujo de registro y detalle de POI sobre las pestañas. */
export type RootStackParamList = {
  Registro: undefined;
  Principal: NavigatorScreenParams<MainTabParamList> | undefined;
  DetallePoi: { poiId: string };
};
