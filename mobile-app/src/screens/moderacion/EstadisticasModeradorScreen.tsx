import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EncabezadoMarca,
  InsigniaModerador,
} from '../../components/EncabezadoMarca';
import {
  obtenerResumenModeracion,
  type ResumenModeracion,
} from '../../services/moderacion';
import type { IconName } from '../../services/types';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from '../../utils/theme';

function Fila({
  icono,
  color,
  titulo,
  valor,
  porcentaje,
}: {
  icono: IconName;
  color: string;
  titulo: string;
  valor: string;
  porcentaje?: number;
}) {
  return (
    <View
      style={estilos.fila}
      accessible
      accessibilityLabel={`${titulo}: ${valor}`}
    >
      <Ionicons name={icono} size={22} color={color} />
      <View style={estilos.textosFila}>
        <View style={estilos.cabeceraFila}>
          <Text style={estilos.tituloFila}>{titulo}</Text>
          <Text style={estilos.valorFila}>{valor}</Text>
        </View>
        {porcentaje !== undefined ? (
          <View style={estilos.barra}>
            <View
              style={[
                estilos.relleno,
                {
                  width: `${Math.min(100, Math.max(0, porcentaje))}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Pestaña «Estadísticas» del panel (los mockups M02–M07 la incluyen en la
 * barra inferior sin diseño propio): cifras reales del backend.
 */
export function EstadisticasModeradorScreen() {
  const [resumen, setResumen] = useState<ResumenModeracion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void obtenerResumenModeracion()
        .then((datos) => {
          setResumen(datos);
          setError(null);
        })
        .catch((causa: Error) => setError(causa.message));
    }, []),
  );

  const d = resumen?.desempeno;

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.cabecera}>
        <EncabezadoMarca tamanoLogo={36} derecha={<InsigniaModerador />} />
      </View>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Estadísticas
        </Text>
        <Text style={estilos.subtitulo}>
          Así avanza la validación de la comunidad.
        </Text>
        {error ? <Text style={estilos.error}>{error}</Text> : null}
        {!resumen && !error ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}
        {resumen && d ? (
          <View style={estilos.tarjeta}>
            <Fila
              icono="checkmark-circle"
              color={colors.success}
              titulo="Tasa de resolución"
              valor={`${d.tasaResolucion}%`}
              porcentaje={d.tasaResolucion}
            />
            <Fila
              icono="document-text"
              color={colors.primary}
              titulo="Reportes pendientes"
              valor={String(resumen.pendientes)}
            />
            <Fila
              icono="warning"
              color={colors.warning}
              titulo="Discrepancias post-viaje abiertas"
              valor={String(resumen.discrepancias)}
            />
            <Fila
              icono="ribbon"
              color={colors.success}
              titulo="Puntos verificados hoy"
              valor={String(resumen.verificadosHoy)}
            />
            <Fila
              icono="person"
              color="#7C3AED"
              titulo="Tus decisiones este mes"
              valor={String(d.procesadosMes)}
            />
            <Fila
              icono="time"
              color="#7C3AED"
              titulo="Tiempo promedio de respuesta"
              valor={d.horasPromedio != null ? `${d.horasPromedio} h` : '—'}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg },
  contenido: { padding: spacing.lg, gap: spacing.md },
  titulo: {
    fontSize: fontSize.xxl + 4,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: { fontSize: fontSize.sm, color: colors.textSlate },
  error: { color: colors.danger },
  tarjeta: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.lg,
  },
  fila: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  textosFila: { flex: 1, gap: 6 },
  cabeceraFila: { flexDirection: 'row', justifyContent: 'space-between' },
  tituloFila: { fontSize: fontSize.sm, color: colors.navy },
  valorFila: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  barra: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  relleno: { height: 8, borderRadius: 4 },
});
