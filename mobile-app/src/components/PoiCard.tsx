import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOGO_CARACTERISTICAS } from '../services/mocks/catalog';
import type { IconName, Poi } from '../services/types';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';
import { Badge } from './Badge';

interface Props {
  poi: Poi;
  onPress?: () => void;
}

const ICONO_CATEGORIA: Record<string, IconName> = {
  Museo: 'business-outline',
  Parque: 'leaf-outline',
  Restaurante: 'restaurant-outline',
  Hotel: 'bed-outline',
  'Centro cultural': 'color-palette-outline',
  Biblioteca: 'book-outline',
  Transporte: 'bus-outline',
};

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
export function PoiCard({ poi, onPress }: Props) {
  const etiquetas = etiquetasAccesibles(poi);
  const verificado = poi.estadoVerificacion === 'VERIFICADO';

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
      <View style={estilos.iconoCategoria}>
        <Ionicons
          name={ICONO_CATEGORIA[poi.categoria] ?? 'location-outline'}
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={estilos.contenido}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {poi.nombre}
        </Text>
        <Text style={estilos.subtitulo} numberOfLines={1}>
          {poi.categoria} · {poi.ciudad}
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
                ? `${poi.confirmaciones} confirmaciones`
                : `En revisión · ${poi.confirmaciones}/3`
            }
          />
        </View>
      </View>
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
  iconoCategoria: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.success,
    fontWeight: fontWeight.medium,
  },
  pie: {
    marginTop: spacing.xs,
  },
});
