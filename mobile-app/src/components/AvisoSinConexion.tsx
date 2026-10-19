import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePoisStore } from '../store/poisStore';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';
import { AppButton } from './AppButton';

/** Cada cuánto se reintenta solo mientras la pantalla está visible. */
const REINTENTO_MS = 15000;

interface Props {
  /** Texto principal; por defecto explica que no hay lugares sin conexión. */
  titulo?: string;
}

/**
 * Aviso único de «sin conexión con la BD» (reemplaza a los datos de
 * demostración). Solo aparece cuando la carga de `GET /mapa` falló y ofrece
 * reintentar sin reiniciar la app. Mientras la pantalla está enfocada y sin
 * conexión, reintenta al enfocarse y cada 15 s (p. ej. si el backend se
 * encendió después de abrir la app).
 */
export function AvisoSinConexion({
  titulo = 'Sin conexión con la base de datos de OmniTravel.',
}: Props) {
  const fuente = usePoisStore((estado) => estado.fuente);
  const cargado = usePoisStore((estado) => estado.cargado);
  const cargando = usePoisStore((estado) => estado.indicadorCarga);
  const advertencia = usePoisStore((estado) => estado.advertencia);
  const cargar = usePoisStore((estado) => estado.cargar);

  const sinConexion = cargado && fuente === 'sin-conexion';

  useFocusEffect(
    useCallback(() => {
      if (!sinConexion) {
        return undefined;
      }
      void cargar();
      const intervalo = setInterval(() => void cargar(), REINTENTO_MS);
      return () => clearInterval(intervalo);
    }, [sinConexion, cargar]),
  );

  if (!sinConexion) {
    return null;
  }

  return (
    <View style={estilos.contenedor} accessibilityLiveRegion="polite">
      <View style={estilos.fila}>
        <Ionicons
          name="cloud-offline-outline"
          size={18}
          color={colors.warning}
        />
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {advertencia ? (
            <Text style={estilos.detalle}>{advertencia}</Text>
          ) : null}
        </View>
      </View>
      <AppButton
        titulo="Reintentar"
        icono="refresh"
        variante="contorno"
        compacto
        cargando={cargando}
        onPress={() => void cargar()}
        pistaAccesibilidad="Vuelve a conectar con el servidor de OmniTravel"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  detalle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
