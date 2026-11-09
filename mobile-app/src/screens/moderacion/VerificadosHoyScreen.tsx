import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import type { RootStackParamList } from '../../navigation/types';
import { listarReportesModeracion } from '../../services/reportes';
import type { ReporteModeracion } from '../../services/types';
import { esDeHoyEnColombia } from '../../utils/verificadosHoy';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../../utils/theme';

/**
 * «Puntos verificados hoy» (M02): reportes publicados hoy (hora de
 * Colombia), por consenso de la comunidad o por decisión del moderador.
 */
export function VerificadosHoyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reportes, setReportes] = useState<ReporteModeracion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      listarReportesModeracion('publicado')
        .then((lista) => {
          if (vigente) {
            setReportes(
              lista
                .filter((r) => esDeHoyEnColombia(r.fechaResolucion))
                .sort(
                  (a, b) =>
                    new Date(b.fechaResolucion ?? 0).getTime() -
                    new Date(a.fechaResolucion ?? 0).getTime(),
                ),
            );
            setError(null);
          }
        })
        .catch((causa: Error) => {
          if (vigente) {
            setError(causa.message);
          }
        });
      return () => {
        vigente = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.barra}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={estilos.botonAtras}
          accessibilityRole="button"
          accessibilityLabel="Volver al panel"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={estilos.titulo} accessibilityRole="header">
          Puntos verificados hoy
        </Text>
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        {reportes === null && !error ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Cargando los puntos verificados"
          />
        ) : null}
        {error ? (
          <Text style={estilos.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {reportes && reportes.length === 0 ? (
          <EmptyState
            icono="checkmark-done-outline"
            titulo="Aún no hay puntos verificados hoy"
            descripcion="Aquí aparecen los reportes publicados hoy por consenso de la comunidad o por tu decisión."
          />
        ) : null}
        {(reportes ?? []).map((reporte) => (
          <Card key={reporte.id} estilo={estilos.tarjeta}>
            <View style={estilos.fila}>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.success}
              />
              <View style={estilos.textos}>
                <Text style={estilos.nombre}>{reporte.poi.nombre}</Text>
                <Text style={estilos.detalle}>
                  {reporte.poi.direccion || 'Armenia, Quindío'}
                </Text>
                <Text style={estilos.detalle}>
                  {reporte.viaResolucion === 'manual'
                    ? 'Aprobado por moderación'
                    : 'Publicado por consenso (3 confirmaciones)'}
                  {reporte.fechaResolucion
                    ? ` · ${new Date(reporte.fechaResolucion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}`
                    : ''}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  botonAtras: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  contenido: { padding: spacing.lg, gap: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.sm },
  tarjeta: { borderRadius: radii.lg },
  fila: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  textos: { flex: 1, gap: 2 },
  nombre: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  detalle: { fontSize: fontSize.sm, color: colors.textSecondary },
});
