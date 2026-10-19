import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

interface Props {
  visible: boolean;
  /** Nombre del lugar publicado, para el mensaje del modal. */
  poiNombre?: string;
  /** Texto propio (p. ej. aprobación del moderador en M04). */
  mensaje?: string;
  onCerrar: () => void;
}

const VERDE = '#1F9D6B';
const VERDE_OSCURO = '#167A6E';

/** Rayos alrededor del check del mockup S01. */
function Rayos() {
  const angulos = [-60, -25, 25, 60, 120, 155, 205, 240];
  return (
    <>
      {angulos.map((angulo) => (
        <View
          key={angulo}
          style={[
            estilos.rayo,
            {
              transform: [{ rotate: `${angulo}deg` }, { translateY: -78 }],
            },
          ]}
        />
      ))}
    </>
  );
}

/**
 * S01 — Modal «¡Validación alcanzada!».
 *
 * Se muestra al registrar la tercera confirmación comunitaria o cuando un
 * moderador aprueba el reporte: el punto pasó a publicado (RNF-18/23).
 * `accessibilityViewIsModal` mantiene el foco del lector dentro (RNF-12).
 */
export function ConsensoAlcanzado({
  visible,
  poiNombre,
  mensaje,
  onCerrar,
}: Props) {
  const texto =
    mensaje ??
    (poiNombre
      ? `Gracias a tus reportes y los de otros 2 usuarios, «${poiNombre}» ahora es visible en el mapa para todos.`
      : 'Gracias a tus reportes y los de otros 2 usuarios, este lugar ahora es visible en el mapa para todos.');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCerrar}
      accessibilityViewIsModal
    >
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
          <View style={estilos.zonaCheck}>
            <Rayos />
            <View style={estilos.halo}>
              <View style={estilos.check}>
                <Ionicons name="checkmark" size={64} color={colors.white} />
              </View>
            </View>
          </View>

          <View
            accessible
            accessibilityLabel={`Validación alcanzada. ${texto}`}
          >
            <Text style={estilos.titulo}>¡Validación alcanzada!</Text>
            <Text style={estilos.mensaje}>{texto}</Text>
          </View>

          <View style={estilos.ilustracion} accessibilityElementsHidden>
            <View style={estilos.personas}>
              <Ionicons name="people" size={46} color={colors.primary} />
            </View>
            <Text style={estilos.puntos}>• • • • ›</Text>
            <View style={estilos.mapa}>
              <Ionicons name="map" size={46} color="#7CC59A" />
              <View style={estilos.pin}>
                <Ionicons name="accessibility" size={18} color={colors.white} />
              </View>
            </View>
          </View>

          <Pressable
            onPress={onCerrar}
            style={({ pressed }) => [
              estilos.boton,
              pressed ? estilos.presionado : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Genial"
          >
            <Text style={estilos.textoBoton}>Genial</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  zonaCheck: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rayo: {
    position: 'absolute',
    width: 5,
    height: 22,
    borderRadius: 3,
    backgroundColor: '#5CC9A7',
  },
  halo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#E3F6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: VERDE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    textAlign: 'center',
  },
  mensaje: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textSlate,
    textAlign: 'center',
    lineHeight: 23,
  },
  ilustracion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  personas: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntos: {
    fontSize: fontSize.lg,
    color: colors.primary,
    letterSpacing: 2,
  },
  mapa: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    position: 'absolute',
    top: -14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: VERDE_OSCURO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boton: {
    alignSelf: 'stretch',
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: VERDE_OSCURO,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  presionado: {
    opacity: 0.85,
  },
  textoBoton: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
});
