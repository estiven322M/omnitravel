import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { denunciarReporte, MOTIVOS_DENUNCIA } from '../services/reportes';
import type { MotivoDenuncia } from '../services/types';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';
import { AppButton } from './AppButton';
import { CampoTexto } from './CampoTexto';

interface Props {
  visible: boolean;
  reporteId: string;
  poiNombre: string;
  onCerrar: () => void;
  /** Se llama cuando el backend registró la denuncia. */
  onDenunciado: () => void;
}

/**
 * C4 — Denunciar un reporte por información falsa, spam o contenido
 * inapropiado. La denuncia saca el reporte del consenso automático y lo envía
 * a moderación (vía B). Una persona denuncia cada reporte una sola vez.
 */
export function DenunciarReporte({
  visible,
  reporteId,
  poiNombre,
  onCerrar,
  onDenunciado,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setMotivo(null);
    setDescripcion('');
    setError(null);
    onCerrar();
  };

  const enviar = async () => {
    if (!motivo) {
      setError('Elige el motivo de la denuncia.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await denunciarReporte(reporteId, motivo, descripcion);
      setMotivo(null);
      setDescripcion('');
      onDenunciado();
    } catch (causa) {
      setError((causa as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={cerrar}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={estilos.fondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={estilos.hoja}>
          <ScrollView
            contentContainerStyle={estilos.contenido}
            keyboardShouldPersistTaps="handled"
          >
            <View style={estilos.encabezado}>
              <Text style={estilos.titulo} accessibilityRole="header">
                Denunciar reporte
              </Text>
              <Pressable
                onPress={cerrar}
                style={estilos.cerrar}
                accessibilityRole="button"
                accessibilityLabel="Cerrar sin denunciar"
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={estilos.texto}>
              ¿Qué está mal en el reporte de «{poiNombre}»? Moderación lo
              revisará antes de que la comunidad pueda publicarlo.
            </Text>

            <View accessibilityRole="radiogroup" style={estilos.motivos}>
              {MOTIVOS_DENUNCIA.map((opcion) => {
                const elegido = motivo === opcion.id;
                return (
                  <Pressable
                    key={opcion.id}
                    onPress={() => {
                      setMotivo(opcion.id);
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    aria-checked={elegido}
                    style={[estilos.motivo, elegido && estilos.motivoElegido]}
                  >
                    <Ionicons
                      name={elegido ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={elegido ? colors.primary : colors.textSecondary}
                    />
                    <Text style={estilos.textoMotivo}>{opcion.etiqueta}</Text>
                  </Pressable>
                );
              })}
            </View>

            <CampoTexto
              etiqueta="Detalle (opcional)"
              icono="create-outline"
              placeholder="Ej.: la rampa que mencionan no existe"
              value={descripcion}
              onChangeText={setDescripcion}
              multilinea
              maximo={500}
            />

            {error ? (
              <Text style={estilos.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <AppButton
              titulo="Enviar denuncia"
              variante="peligro"
              icono="flag"
              cargando={enviando}
              deshabilitado={enviando}
              onPress={() => void enviar()}
            />
            <AppButton titulo="Cancelar" variante="fantasma" onPress={cerrar} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  hoja: {
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  contenido: { padding: spacing.lg, gap: spacing.md },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  cerrar: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: fontSize.sm, color: colors.textSecondary },
  motivos: { gap: spacing.sm },
  motivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  motivoElegido: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  textoMotivo: { fontSize: fontSize.md, color: colors.textPrimary },
  error: { fontSize: fontSize.sm, color: colors.danger },
});
