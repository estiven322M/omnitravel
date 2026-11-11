import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { colors, fontSize, fontWeight } from '../utils/theme';

/** Alto de la barra sin contar la zona de los botones del sistema. */
export const ALTO_BARRA = 66;

/**
 * Barra inferior común de los mockups (U04, U06, M02).
 *
 * El alto suma el margen inferior del sistema (botones de navegación de
 * Android): con un alto fijo, ese margen se comía la barra, los botones
 * quedaban casi sin área táctil y el «+ Contribuir» no respondía al toque.
 */
export function opcionesBarraInferior(
  margenInferior: number,
): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSlate,
    tabBarStyle: {
      backgroundColor: colors.white,
      borderTopColor: colors.border,
      height: ALTO_BARRA + margenInferior,
      paddingTop: 6,
      paddingBottom: margenInferior,
    },
    tabBarLabelStyle: {
      fontSize: fontSize.xs - 1,
      fontWeight: fontWeight.semibold,
      marginBottom: 6,
    },
  };
}
