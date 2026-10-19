import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { colors, fontSize, fontWeight } from '../utils/theme';

/** Barra inferior común de los mockups (U04, U06, M02). */
export const opcionesBarraInferior: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textSlate,
  tabBarStyle: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    height: 66,
    paddingTop: 6,
  },
  tabBarLabelStyle: {
    fontSize: fontSize.xs - 1,
    fontWeight: fontWeight.semibold,
    marginBottom: 6,
  },
};
