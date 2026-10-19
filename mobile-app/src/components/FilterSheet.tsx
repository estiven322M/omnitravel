import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { IconName } from '../services/types';
import { FILTROS, type FiltroId } from '../utils/filters';
import { colors, fontSize, fontWeight, radii, spacing } from '../utils/theme';
import { AppButton } from './AppButton';
import { ToggleRow } from './ToggleRow';

interface Props {
  visible: boolean;
  filtrosActivos: FiltroId[];
  onAplicar: (filtros: FiltroId[]) => void;
  onCerrar: () => void;
}

const ICONOS: Record<FiltroId, IconName> = {
  ancho_puerta_80: 'enter-outline',
  sin_escalones: 'trending-up-outline',
  ascensor_amplio: 'swap-vertical-outline',
  semaforos_sonoros: 'volume-high-outline',
  menu_braille: 'apps-outline',
  piso_podotactil: 'grid-outline',
};

const DESCRIPCIONES: Record<FiltroId, string> = {
  ancho_puerta_80: 'Entradas y puertas accesibles',
  sin_escalones: 'Rutas sin barreras físicas',
  ascensor_amplio: 'Espacio suficiente para silla de ruedas',
  semaforos_sonoros: 'Cruces peatonales con aviso auditivo',
  menu_braille: 'Información en establecimientos',
  piso_podotactil: 'Señalización táctil en rutas',
};

/**
 * Hoja inferior de filtros de accesibilidad (U05).
 * Los filtros se generan dinámicamente desde el catálogo de características.
 */
export function FilterSheet({
  visible,
  filtrosActivos,
  onAplicar,
  onCerrar,
}: Props) {
  const [seleccion, setSeleccion] = useState<FiltroId[]>(filtrosActivos);

  const alternar = (id: FiltroId) => {
    setSeleccion((previos) =>
      previos.includes(id)
        ? previos.filter((filtro) => filtro !== id)
        : [...previos, id],
    );
  };

  const aplicar = () => {
    onAplicar(seleccion);
    // Retroalimentación auditiva de la acción crítica (RNF-14).
    AccessibilityInfo.announceForAccessibility(
      `Filtros aplicados. ${seleccion.length} filtros activos.`,
    );
    onCerrar();
  };

  const limpiar = () => setSeleccion([]);

  const grupos: {
    titulo: string;
    subtitulo: string;
    grupo: 'motriz' | 'sensorial';
    icono: IconName;
    color: string;
    fondo: string;
  }[] = [
    {
      titulo: 'Físico/Motriz',
      subtitulo: 'Espacios más accesibles y seguros',
      grupo: 'motriz',
      icono: 'accessibility',
      color: colors.primary,
      fondo: '#EEF4FC',
    },
    {
      titulo: 'Sensorial',
      subtitulo: 'Información y entornos inclusivos',
      grupo: 'sensorial',
      icono: 'eye',
      color: colors.success,
      fondo: '#ECF6EF',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCerrar}
      // Al abrir, sincroniza la copia local con los filtros guardados.
      onShow={() => setSeleccion(filtrosActivos)}
    >
      <View style={estilos.contenedor}>
        <Pressable
          style={estilos.fondo}
          onPress={onCerrar}
          accessible={false}
        />
        <View style={estilos.hoja} accessibilityViewIsModal>
          <View style={estilos.encabezado}>
            <View style={estilos.encabezadoTextos}>
              <Text style={estilos.titulo}>Filtros de Accesibilidad</Text>
              <Text style={estilos.subtitulo}>
                Personaliza tu búsqueda según tus necesidades
              </Text>
            </View>
            <Pressable
              onPress={onCerrar}
              style={estilos.botonCerrar}
              accessibilityRole="button"
              accessibilityLabel="Cerrar filtros"
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            style={estilos.lista}
            contentContainerStyle={estilos.listaContenido}
          >
            {grupos.map(({ titulo, subtitulo, grupo, icono, color, fondo }) => (
              <View key={grupo} style={estilos.seccion}>
                <View
                  style={[estilos.bandaSeccion, { backgroundColor: fondo }]}
                  accessibilityRole="header"
                  accessible
                  accessibilityLabel={`${titulo}. ${subtitulo}`}
                >
                  <View
                    style={[estilos.iconoSeccion, { backgroundColor: color }]}
                  >
                    <Ionicons name={icono} size={24} color={colors.white} />
                  </View>
                  <View style={estilos.textosSeccion}>
                    <Text style={estilos.tituloSeccion}>{titulo}</Text>
                    <Text style={estilos.subtituloSeccion}>{subtitulo}</Text>
                  </View>
                </View>
                {FILTROS.filter((filtro) => filtro.grupo === grupo).map(
                  (filtro) => (
                    <ToggleRow
                      key={filtro.id}
                      etiqueta={filtro.etiqueta}
                      descripcion={DESCRIPCIONES[filtro.id]}
                      icono={ICONOS[filtro.id]}
                      valor={seleccion.includes(filtro.id)}
                      onCambio={() => alternar(filtro.id)}
                    />
                  ),
                )}
              </View>
            ))}
          </ScrollView>

          <View style={estilos.pie}>
            <AppButton
              titulo="Limpiar"
              variante="contorno"
              forma="redondeado"
              onPress={limpiar}
              estilo={estilos.botonPie}
            />
            <AppButton
              titulo="Aplicar filtros"
              icono="options-outline"
              forma="redondeado"
              onPress={aplicar}
              estilo={estilos.botonPie}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fondo: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  hoja: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    maxHeight: '85%',
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  encabezadoTextos: {
    flex: 1,
  },
  titulo: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  botonCerrar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
  },
  lista: {
    marginTop: spacing.sm,
  },
  listaContenido: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  seccion: {
    marginTop: spacing.md,
  },
  bandaSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  iconoSeccion: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosSeccion: {
    flex: 1,
  },
  tituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.navy,
  },
  subtituloSeccion: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  pie: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  botonPie: {
    flex: 1,
  },
});
