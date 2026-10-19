import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fotoDePoi } from '../services/mocks/fotosPoi';
import type { IconName, Poi } from '../services/types';
import { useFavoritosStore } from '../store/favoritosStore';
import { formatearDistancia } from '../utils/format';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';

interface Props {
  poi: Poi;
  /** Distancia en línea recta desde tu ubicación (se omite sin permiso). */
  distanciaKm?: number;
  onPress?: () => void;
  /** Oculta el corazón (cuando la vista ya ofrece su propio botón). */
  muestraFavorito?: boolean;
}

interface Etiqueta {
  texto: string;
  icono: IconName;
}

/** Etiqueta con icono (estilo mockup U04) de una característica confirmada. */
export function etiquetaDeCaracteristica(
  caracteristicaId: string,
  booleano?: boolean,
  numerico?: number,
): Etiqueta | null {
  switch (caracteristicaId) {
    case 'tiene_rampa':
      return booleano === true
        ? { texto: 'Rampa confirmada', icono: 'accessibility' }
        : null;
    case 'tiene_escaleras':
      return booleano === false
        ? { texto: 'Sin escalones', icono: 'trending-up' }
        : null;
    case 'tiene_bano_accesible':
      return booleano === true
        ? { texto: 'Baño adaptado', icono: 'man' }
        : null;
    case 'tiene_ascensor':
      return booleano === true
        ? { texto: 'Ascensor', icono: 'swap-vertical' }
        : null;
    case 'tiene_braille':
      return booleano === true
        ? { texto: 'Menú Braille', icono: 'restaurant' }
        : null;
    case 'tiene_piso_podotactil':
      return booleano === true
        ? { texto: 'Señalización táctil', icono: 'eye' }
        : null;
    case 'tiene_semaforo_sonoro':
      return booleano === true
        ? { texto: 'Semáforo sonoro', icono: 'volume-high' }
        : null;
    case 'ancho_puerta':
      return numerico !== undefined && numerico >= 80
        ? { texto: `Puerta ${numerico} cm`, icono: 'resize' }
        : null;
    default:
      return null;
  }
}

/** Máximo de etiquetas por tarjeta (el resto vive en el detalle del lugar). */
const MAX_ETIQUETAS = 3;

/** Tarjeta del feed U04: foto, distancia y confiabilidad comunitaria. */
export function PoiCardFeed({
  poi,
  distanciaKm,
  onPress,
  muestraFavorito = true,
}: Props) {
  const foto = fotoDePoi(poi.nombre, poi.categoria);
  const verificado = poi.estadoVerificacion === 'VERIFICADO';
  const esFavorito = useFavoritosStore((estado) => estado.ids.includes(poi.id));
  const alternarFavorito = useFavoritosStore((estado) => estado.alternar);
  const [guardandoFavorito, setGuardandoFavorito] = useState(false);

  const etiquetas = poi.valores
    .map((valor) =>
      etiquetaDeCaracteristica(
        valor.caracteristicaId,
        valor.valorBooleano,
        valor.valorNumerico,
      ),
    )
    .filter((etiqueta): etiqueta is Etiqueta => etiqueta != null)
    .slice(0, MAX_ETIQUETAS);

  const alternarGuardado = () => {
    if (guardandoFavorito) {
      return;
    }
    setGuardandoFavorito(true);
    // El store revierte si la BD rechaza; el icono nunca miente un rato largo.
    void alternarFavorito(poi.id)
      .catch(() => undefined)
      .finally(() => setGuardandoFavorito(false));
  };

  const etiquetaDistancia =
    distanciaKm !== undefined ? formatearDistancia(distanciaKm) : null;
  const textoValidaciones = `${poi.confirmaciones} ${
    poi.confirmaciones === 1 ? 'validación' : 'validaciones'
  }`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${poi.nombre}, ${poi.categoria} en ${poi.ciudad}.${
        etiquetaDistancia ? ` A ${etiquetaDistancia} de ti.` : ''
      } ${textoValidaciones} de la comunidad. ${
        verificado
          ? 'Accesibilidad verificada.'
          : 'En revisión por la comunidad.'
      }`}
      accessibilityHint={onPress ? 'Abre el detalle del lugar' : undefined}
      style={({ pressed }) => [
        estilos.tarjeta,
        pressed ? estilos.presionado : null,
      ]}
    >
      <View style={estilos.foto}>
        <Image
          source={foto.fuente}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={
            foto.referencia
              ? `Foto de referencia de ${poi.categoria}`
              : `Foto de ${poi.nombre}`
          }
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={estilos.contenido}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {poi.nombre}
        </Text>
        <Text style={estilos.subtitulo} numberOfLines={1}>
          {poi.categoria} • {poi.ciudad}
        </Text>

        {etiquetaDistancia ? (
          <View style={estilos.filaDistancia}>
            <Ionicons name="location" size={13} color={colors.primary} />
            <Text style={estilos.textoDistancia}>{etiquetaDistancia}</Text>
          </View>
        ) : null}

        {etiquetas.length > 0 ? (
          <View style={estilos.etiquetas}>
            {etiquetas.map((etiqueta) => (
              <View key={etiqueta.texto} style={estilos.etiqueta}>
                <Ionicons
                  name={etiqueta.icono}
                  size={12}
                  color={colors.success}
                />
                <Text style={estilos.etiquetaTexto}>{etiqueta.texto}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={estilos.pie}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <View style={estilos.textosPie}>
            <Text style={estilos.validaciones}>{textoValidaciones}</Text>
            <Text style={estilos.confiabilidad} numberOfLines={1}>
              Confiabilidad comunitaria
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.primary}
            style={estilos.chevron}
          />
        </View>
      </View>

      {muestraFavorito ? (
        <Pressable
          onPress={alternarGuardado}
          disabled={guardandoFavorito}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={
            esFavorito
              ? `Quitar ${poi.nombre} de guardados`
              : `Guardar ${poi.nombre} en favoritos`
          }
          style={estilos.botonCorazon}
        >
          <Ionicons
            name={esFavorito ? 'heart' : 'heart-outline'}
            size={20}
            color={esFavorito ? colors.danger : colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  presionado: {
    opacity: 0.9,
  },
  foto: {
    width: 116,
    alignSelf: 'stretch',
    minHeight: 132,
    margin: spacing.sm,
    marginRight: 0,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  contenido: {
    flex: 1,
    padding: spacing.sm,
    paddingTop: spacing.md,
    paddingRight: spacing.sm,
    gap: 2,
  },
  nombre: {
    paddingRight: 30,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  filaDistancia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  textoDistancia: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  etiquetaTexto: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: colors.success,
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textosPie: {
    flex: 1,
    gap: 1,
  },
  validaciones: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  confiabilidad: {
    fontSize: 11,
    color: colors.primary,
  },
  chevron: {
    marginRight: -2,
  },
  botonCorazon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
