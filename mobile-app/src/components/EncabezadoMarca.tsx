import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';
import { BrandMark } from './BrandMark';

interface Props {
  /** Muestra «‹ Atrás»/«‹ Volver» a la izquierda del logo (U09, U10, M03…). */
  onAtras?: () => void;
  textoAtras?: string;
  /** Acciones de la derecha (campana, avatar, «Modo Moderador»…). */
  derecha?: ReactNode;
  /** Alto del logo (los mockups usan ~40 en cabeceras). */
  tamanoLogo?: number;
}

/**
 * Cabecera común de los mockups: logo completo («OmniTravel · Tu mundo, sin
 * barreras») a la izquierda y acciones a la derecha.
 */
export function EncabezadoMarca({
  onAtras,
  textoAtras,
  derecha,
  tamanoLogo = 40,
}: Props) {
  return (
    <View style={estilos.fila}>
      {onAtras ? (
        <Pressable
          onPress={onAtras}
          style={estilos.atras}
          accessibilityRole="button"
          accessibilityLabel={textoAtras ?? 'Volver'}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          {textoAtras ? (
            <Text style={estilos.textoAtras}>{textoAtras}</Text>
          ) : null}
        </Pressable>
      ) : null}
      <View style={estilos.logo}>
        <BrandMark variante="completo" tamano={tamanoLogo} />
      </View>
      {derecha ? <View style={estilos.derecha}>{derecha}</View> : null}
    </View>
  );
}

/** Insignia «Modo Moderador» de las cabeceras M02–M07. */
export function InsigniaModerador() {
  return (
    <View
      style={estilos.insignia}
      accessible
      accessibilityLabel="Modo moderador activo"
    >
      <Ionicons name="shield-checkmark" size={20} color={colors.textSlate} />
      <Text style={estilos.insigniaTexto}>{'Modo\nModerador'}</Text>
    </View>
  );
}

/** Avatar circular con la inicial de la cuenta (no hay fotos en el servidor). */
export function AvatarInicial({
  texto,
  tamano = 40,
  enLinea = false,
  fotoUri,
}: {
  texto: string;
  tamano?: number;
  enLinea?: boolean;
  /** Foto de perfil de la cuenta; sin ella se muestra la inicial. */
  fotoUri?: string;
}) {
  return (
    <View
      style={[
        estilos.avatar,
        { width: tamano, height: tamano, borderRadius: tamano / 2 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {fotoUri ? (
        <Image
          source={{ uri: fotoUri }}
          style={{ width: tamano, height: tamano, borderRadius: tamano / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[estilos.avatarTexto, { fontSize: tamano * 0.42 }]}>
          {(texto.trim().charAt(0) || '?').toUpperCase()}
        </Text>
      )}
      {enLinea ? <View style={estilos.enLinea} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  atras: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    paddingRight: spacing.xs,
  },
  textoAtras: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  logo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  derecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  insignia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insigniaTexto: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSlate,
  },
  avatar: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  enLinea: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
