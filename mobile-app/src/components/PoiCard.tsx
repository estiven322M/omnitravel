import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { CATALOGO_CARACTERISTICAS } from '../services/mocks/catalog';
import type { Poi } from '../services/types';
import { useFavoritosStore } from '../store/favoritosStore';
import { fotoDePoi } from '../services/mocks/fotosPoi';
import { formatearDistancia } from '../utils/format';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';
import { Badge } from './Badge';

interface Props {
  poi: Poi;
  /** Distancia en línea recta desde tu ubicación (se omite sin permiso). */
  distanciaKm?: number;
  onPress?: () => void;
  /** Oculta el corazón (cuando la vista ya ofrece su propio botón). */
  muestraFavorito?: boolean;
}

function etiquetasAccesibles(poi: Poi): string[] {
  return CATALOGO_CARACTERISTICAS.filter((caracteristica) =>
    poi.valores.some(
      (valor) =>
        valor.caracteristicaId === caracteristica.id &&
        valor.valorBooleano === true,
    ),
  )
    .slice(0, 3)
    .map((caracteristica) => caracteristica.nombre);
}

/** Tarjeta resumen de un POI (mapa y listados). */
export function PoiCard({
  poi,
  distanciaKm,
  onPress,
  muestraFavorito = true,
}: Props) {
  const etiquetas = etiquetasAccesibles(poi);
  const verificado = poi.estadoVerificacion === 'VERIFICADO';
  const foto = fotoDePoi(poi.nombre, poi.categoria);
  const esFavorito = useFavoritosStore((estado) => estado.ids.includes(poi.id));
  const alternarFavorito = useFavoritosStore((estado) => estado.alternar);
  const [guardandoFavorito, setGuardandoFavorito] = useState(false);

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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${poi.nombre}, ${poi.categoria} en ${poi.ciudad}. ${
        verificado ? 'Accesibilidad verificada' : 'En revisión por la comunidad'
      }.`}
      accessibilityHint={onPress ? 'Abre el detalle del lugar' : undefined}
      style={({ pressed }) => [
        estilos.tarjeta,
        pressed ? estilos.presionado : null,
      ]}
    >
      <Image
        source={foto.fuente}
        style={estilos.foto}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={estilos.contenido}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {poi.nombre}
        </Text>
        <Text style={estilos.subtitulo} numberOfLines={1}>
          {poi.categoria} • {poi.ciudad}
        </Text>
        {etiquetas.length > 0 ? (
          <View style={estilos.etiquetas}>
            {etiquetas.map((etiqueta) => (
              <View key={etiqueta} style={estilos.etiqueta}>
                <Ionicons name="checkmark" size={11} color={colors.success} />
                <Text style={estilos.etiquetaTexto}>{etiqueta}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={estilos.pie}>
          <Badge
            tono={verificado ? 'exito' : 'alerta'}
            texto={
              verificado
                ? `${poi.confirmaciones} validaciones`
                : `En revisión · ${poi.confirmaciones}/3`
            }
          />
          {distanciaKm !== undefined ? (
            <View style={estilos.filaDistancia}>
              <Ionicons name="location" size={12} color={colors.primary} />
              <Text style={estilos.textoDistancia}>
                {formatearDistancia(distanciaKm)}
              </Text>
            </View>
          ) : null}
          {onPress ? (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
              style={estilos.chevron}
            />
          ) : null}
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
          <View style={estilos.fondoCorazon}>
            <Ionicons
              name={esFavorito ? 'heart' : 'heart-outline'}
              size={17}
              color={esFavorito ? colors.danger : colors.textSecondary}
            />
          </View>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presionado: {
    opacity: 0.9,
  },
  foto: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  contenido: {
    flex: 1,
    gap: 2,
  },
  nombre: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  subtitulo: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
    gap: 2,
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  etiquetaTexto: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: colors.success,
  },
  botonCorazon: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fondoCorazon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pie: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filaDistancia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  textoDistancia: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  chevron: {
    marginLeft: 'auto',
  },
});
