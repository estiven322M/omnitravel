import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
  obtenerEstadisticasModeracion,
  obtenerResumenModeracion,
  type EstadisticasModeracion,
  type ResumenModeracion,
} from '../../services/moderacion';
import type { IconName } from '../../services/types';
import {
  etiquetaDia,
  maximoRedondo,
  segmentosDe,
  variacion,
} from '../../utils/estadisticas';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  shadow,
  spacing,
} from '../../utils/theme';

/**
 * Colores de los gráficos. Series: slots 1–2 de la paleta categórica validada
 * (azul y naranja: separación ΔE ≥ 24 incluso con daltonismo). Estados:
 * paleta de estado, siempre acompañada de ícono y texto.
 */
const SERIE = { recibidos: '#2a78d6', resueltos: '#eb6834' };
const ESTADO = {
  bueno: '#0ca30c',
  advertencia: '#fab219',
  serio: '#ec835a',
  critico: '#d03b3b',
  neutro: '#8A94A6',
};

const ESTADOS_REPORTE: {
  clave: string;
  texto: string;
  color: string;
  icono: IconName;
}[] = [
  {
    clave: 'pendiente_validacion',
    texto: 'Pendientes',
    color: ESTADO.advertencia,
    icono: 'hourglass-outline',
  },
  {
    clave: 'en_revision',
    texto: 'En revisión',
    color: ESTADO.neutro,
    icono: 'eye-outline',
  },
  {
    clave: 'publicado',
    texto: 'Publicados',
    color: ESTADO.bueno,
    icono: 'checkmark-circle-outline',
  },
  {
    clave: 'rechazado',
    texto: 'Rechazados',
    color: ESTADO.critico,
    icono: 'close-circle-outline',
  },
];

const GRAVEDADES: {
  clave: 'alta' | 'media' | 'baja';
  texto: string;
  color: string;
  icono: IconName;
}[] = [
  {
    clave: 'alta',
    texto: 'Alta',
    color: ESTADO.critico,
    icono: 'alert-circle',
  },
  { clave: 'media', texto: 'Media', color: ESTADO.serio, icono: 'warning' },
  {
    clave: 'baja',
    texto: 'Baja',
    color: ESTADO.advertencia,
    icono: 'information-circle',
  },
];

/** Tarjeta de cifra clave (stat tile). */
function Cifra({
  icono,
  color,
  fondo,
  valor,
  titulo,
  detalle,
}: {
  icono: IconName;
  color: string;
  fondo: string;
  valor: string;
  titulo: string;
  detalle?: string;
}) {
  return (
    <View
      style={estilos.cifra}
      accessible
      accessibilityLabel={`${titulo}: ${valor}${detalle ? `. ${detalle}` : ''}`}
    >
      <View style={[estilos.iconoCifra, { backgroundColor: fondo }]}>
        <Ionicons name={icono} size={20} color={color} />
      </View>
      <Text style={estilos.valorCifra}>{valor}</Text>
      <Text style={estilos.tituloCifra}>{titulo}</Text>
      {detalle ? <Text style={estilos.detalleCifra}>{detalle}</Text> : null}
    </View>
  );
}

function Seccion({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.tituloSeccion} accessibilityRole="header">
        {titulo}
      </Text>
      {subtitulo ? (
        <Text style={estilos.subtituloSeccion}>{subtitulo}</Text>
      ) : null}
      {children}
    </View>
  );
}

/** Barra apilada de los reportes por estado, con leyenda y conteos. */
function EstadoReportes({ conteos }: { conteos: Record<string, number> }) {
  const segmentos = segmentosDe(
    conteos,
    ESTADOS_REPORTE.map((estado) => estado.clave),
  );
  const total = segmentos.reduce((suma, s) => suma + s.total, 0);
  if (total === 0) {
    return <Text style={estilos.vacio}>Aún no hay reportes.</Text>;
  }
  return (
    <>
      <View style={estilos.barraApilada}>
        {segmentos.map((segmento) => {
          const estado = ESTADOS_REPORTE.find(
            (e) => e.clave === segmento.clave,
          );
          return (
            <View
              key={segmento.clave}
              style={[
                estilos.segmento,
                { flex: segmento.total, backgroundColor: estado?.color },
              ]}
            />
          );
        })}
      </View>
      <View style={estilos.leyenda}>
        {ESTADOS_REPORTE.map((estado) => {
          const cantidad = conteos[estado.clave] ?? 0;
          const porcentaje = Math.round((cantidad / total) * 100);
          return (
            <View
              key={estado.clave}
              style={estilos.filaLeyenda}
              accessible
              accessibilityLabel={`${estado.texto}: ${cantidad}, ${porcentaje} por ciento`}
            >
              <View
                style={[
                  estilos.puntoLeyenda,
                  { backgroundColor: estado.color },
                ]}
              />
              <Ionicons
                name={estado.icono}
                size={16}
                color={colors.textSlate}
              />
              <Text style={estilos.textoLeyenda}>{estado.texto}</Text>
              <Text style={estilos.valorLeyenda}>{cantidad}</Text>
              <Text style={estilos.porcentajeLeyenda}>{porcentaje}%</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

/** Barras agrupadas de los últimos 7 días (recibidos y resueltos). */
function Actividad({ dias }: { dias: EstadisticasModeracion['actividad'] }) {
  const [seleccion, setSeleccion] = useState<number>(dias.length - 1);
  const maximo = maximoRedondo(dias.flatMap((d) => [d.recibidos, d.resueltos]));
  const elegido = dias[seleccion];
  const ALTO = 120;

  return (
    <>
      <View style={estilos.leyendaSeries}>
        {(['recibidos', 'resueltos'] as const).map((serie) => (
          <View key={serie} style={estilos.itemSerie}>
            <View
              style={[estilos.puntoLeyenda, { backgroundColor: SERIE[serie] }]}
            />
            <Text style={estilos.textoLeyenda}>
              {serie === 'recibidos' ? 'Recibidos' : 'Resueltos'}
            </Text>
          </View>
        ))}
      </View>

      {elegido ? (
        <View style={estilos.detalleDia} accessibilityLiveRegion="polite">
          <Text style={estilos.detalleDiaFecha}>
            {etiquetaDia(elegido.dia)}
          </Text>
          <Text style={estilos.detalleDiaTexto}>
            {elegido.recibidos} recibidos · {elegido.resueltos} resueltos
          </Text>
        </View>
      ) : null}

      <View style={estilos.grafico}>
        <View style={estilos.ejeY}>
          <Text style={estilos.textoEje}>{maximo}</Text>
          <Text style={estilos.textoEje}>0</Text>
        </View>
        <View style={[estilos.zonaBarras, { height: ALTO }]}>
          <View style={[estilos.lineaGuia, { top: 0 }]} />
          <View style={[estilos.lineaGuia, { top: ALTO / 2 }]} />
          {dias.map((dia, indice) => {
            const activo = indice === seleccion;
            return (
              <Pressable
                key={dia.dia}
                onPress={() => setSeleccion(indice)}
                style={estilos.grupoBarras}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`${etiquetaDia(dia.dia)}: ${dia.recibidos} recibidos, ${dia.resueltos} resueltos`}
              >
                <View style={estilos.parBarras}>
                  {(['recibidos', 'resueltos'] as const).map((serie) => (
                    <View
                      key={serie}
                      style={[
                        estilos.barraVertical,
                        {
                          height: Math.max(
                            dia[serie] > 0 ? 4 : 0,
                            (dia[serie] / maximo) * ALTO,
                          ),
                          backgroundColor: SERIE[serie],
                          opacity: activo ? 1 : 0.55,
                        },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={estilos.ejeX}>
        {dias.map((dia, indice) => (
          <Text
            key={dia.dia}
            style={[
              estilos.textoEjeX,
              indice === seleccion ? estilos.textoEjeXActivo : null,
            ]}
          >
            {etiquetaDia(dia.dia).split(' ')[0]}
          </Text>
        ))}
      </View>
    </>
  );
}

/** Incidencias abiertas por gravedad (barras horizontales). */
function Gravedades({
  conteos,
}: {
  conteos: EstadisticasModeracion['incidenciasPorGravedad'];
}) {
  const maximo = Math.max(1, ...GRAVEDADES.map((g) => conteos[g.clave] ?? 0));
  return (
    <View style={estilos.listaGravedad}>
      {GRAVEDADES.map((gravedad) => {
        const cantidad = conteos[gravedad.clave] ?? 0;
        return (
          <View
            key={gravedad.clave}
            style={estilos.filaGravedad}
            accessible
            accessibilityLabel={`Gravedad ${gravedad.texto}: ${cantidad} incidencias`}
          >
            <View style={estilos.etiquetaGravedad}>
              <Ionicons
                name={gravedad.icono}
                size={16}
                color={gravedad.color}
              />
              <Text style={estilos.textoLeyenda}>{gravedad.texto}</Text>
            </View>
            <View style={estilos.pistaGravedad}>
              <View
                style={[
                  estilos.rellenoGravedad,
                  {
                    width: `${(cantidad / maximo) * 100}%`,
                    backgroundColor: gravedad.color,
                  },
                ]}
              />
            </View>
            <Text style={estilos.valorLeyenda}>{cantidad}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Pestaña «Estadísticas» del panel de moderación: cifras clave, estado de
 * los reportes, actividad de la semana, incidencias post-viaje por gravedad
 * y la opinión de los viajeros. Datos reales del backend.
 */
export function EstadisticasModeradorScreen() {
  const [resumen, setResumen] = useState<ResumenModeracion | null>(null);
  const [estadisticas, setEstadisticas] =
    useState<EstadisticasModeracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(() => {
    return Promise.all([
      obtenerResumenModeracion(),
      obtenerEstadisticasModeracion(),
    ])
      .then(([datosResumen, datosEstadisticas]) => {
        setResumen(datosResumen);
        setEstadisticas(datosEstadisticas);
        setError(null);
      })
      .catch((causa: Error) => setError(causa.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const recargar = () => {
    setRecargando(true);
    void cargar().finally(() => setRecargando(false));
  };

  const d = resumen?.desempeno;
  const cambioMes = d
    ? variacion(d.procesadosMes, d.procesadosMesAnterior)
    : null;
  const lugares = estadisticas?.lugaresPorEstado ?? {};
  const totalLugares = Object.values(lugares).reduce((a, b) => a + b, 0);
  const vias = estadisticas?.viasResolucion;
  const totalVias = vias ? vias.automatica + vias.manual : 0;

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.cabecera}>
        <EncabezadoMarca tamanoLogo={36} derecha={<InsigniaModerador />} />
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl refreshing={recargando} onRefresh={recargar} />
        }
      >
        <Text style={estilos.titulo} accessibilityRole="header">
          Estadísticas
        </Text>
        <Text style={estilos.subtitulo}>
          Así avanza la validación de la comunidad en Armenia.
        </Text>

        {error ? (
          <View style={estilos.bloqueError}>
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color={colors.danger}
            />
            <Text style={estilos.textoError}>{error}</Text>
          </View>
        ) : null}
        {!resumen && !error ? (
          <ActivityIndicator color={colors.primary} style={estilos.cargando} />
        ) : null}

        {resumen && d ? (
          <View style={estilos.rejilla}>
            <Cifra
              icono="checkmark-done"
              color={colors.success}
              fondo={colors.successSoft}
              valor={`${d.tasaResolucion}%`}
              titulo="Tasa de resolución"
              detalle="Reportes publicados o rechazados"
            />
            <Cifra
              icono="document-text"
              color={colors.primary}
              fondo={colors.primarySoft}
              valor={String(resumen.pendientes)}
              titulo="Reportes pendientes"
              detalle="Esperando validación"
            />
            <Cifra
              icono="warning"
              color={colors.warning}
              fondo={colors.warningSoft}
              valor={String(resumen.discrepancias)}
              titulo="Incidencias abiertas"
              detalle="Post-viaje (Proceso 3)"
            />
            <Cifra
              icono="ribbon"
              color="#6250d6"
              fondo="#EFEDFB"
              valor={String(resumen.verificadosHoy)}
              titulo="Verificados hoy"
              detalle={
                totalLugares > 0
                  ? `${totalLugares} lugares en el mapa`
                  : undefined
              }
            />
          </View>
        ) : null}

        {estadisticas ? (
          <>
            <Seccion
              titulo="Estado de los reportes"
              subtitulo="Todos los aportes de la comunidad (Proceso 1)"
            >
              <EstadoReportes conteos={estadisticas.reportesPorEstado} />
              {vias && totalVias > 0 ? (
                <Text style={estilos.nota}>
                  {Math.round((vias.automatica / totalVias) * 100)}% se resolvió
                  por consenso comunitario (3 confirmaciones) y{' '}
                  {Math.round((vias.manual / totalVias) * 100)}% por moderación.
                </Text>
              ) : null}
            </Seccion>

            <Seccion
              titulo="Actividad de la semana"
              subtitulo="Toca un día para ver sus cifras"
            >
              <Actividad dias={estadisticas.actividad} />
            </Seccion>

            <Seccion
              titulo="Incidencias post-viaje abiertas"
              subtitulo="Según la gravedad de la calificación del viajero"
            >
              <Gravedades conteos={estadisticas.incidenciasPorGravedad} />
            </Seccion>

            <Seccion titulo="Opinión de los viajeros">
              <View
                style={estilos.opinion}
                accessible
                accessibilityLabel={`Calificación promedio ${estadisticas.experiencias.promedio} de 5, ${estadisticas.experiencias.total} experiencias`}
              >
                <Text style={estilos.valorOpinion}>
                  {estadisticas.experiencias.promedio.toFixed(1)}
                </Text>
                <View style={estilos.textosOpinion}>
                  <View style={estilos.estrellas}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={
                          estadisticas.experiencias.promedio >= n
                            ? 'star'
                            : estadisticas.experiencias.promedio >= n - 0.5
                              ? 'star-half'
                              : 'star-outline'
                        }
                        size={18}
                        color="#F5B301"
                      />
                    ))}
                  </View>
                  <Text style={estilos.detalleCifra}>
                    {estadisticas.experiencias.total} experiencias registradas
                  </Text>
                </View>
              </View>
            </Seccion>
          </>
        ) : null}

        {d ? (
          <Seccion titulo="Tu desempeño este mes">
            <View style={estilos.filaDesempeno}>
              <View style={estilos.desempeno}>
                <Text style={estilos.valorDesempeno}>{d.procesadosMes}</Text>
                <Text style={estilos.tituloCifra}>Decisiones tomadas</Text>
                {cambioMes != null ? (
                  <View style={estilos.cambio}>
                    <Ionicons
                      name={cambioMes >= 0 ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={colors.textSlate}
                    />
                    <Text style={estilos.detalleCifra}>
                      {Math.abs(cambioMes)}% frente al mes anterior
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={estilos.separadorVertical} />
              <View style={estilos.desempeno}>
                <Text style={estilos.valorDesempeno}>
                  {d.horasPromedio != null ? `${d.horasPromedio} h` : '—'}
                </Text>
                <Text style={estilos.tituloCifra}>Tiempo promedio</Text>
                <Text style={estilos.detalleCifra}>de respuesta</Text>
              </View>
            </View>
          </Seccion>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.surface },
  cabecera: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  contenido: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  titulo: {
    fontSize: fontSize.xxl + 4,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtitulo: { fontSize: fontSize.sm, color: colors.textSlate },
  cargando: { marginTop: spacing.xl },
  bloqueError: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
  },
  textoError: { flex: 1, color: colors.danger, fontSize: fontSize.sm },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cifra: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 2,
    ...shadow.card,
  },
  iconoCifra: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  valorCifra: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  tituloCifra: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  detalleCifra: { fontSize: fontSize.xs, color: colors.textSlate },
  seccion: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  tituloSeccion: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  subtituloSeccion: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    marginTop: -spacing.sm,
  },
  vacio: { color: colors.textSlate, fontSize: fontSize.sm },
  barraApilada: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    gap: 2,
  },
  segmento: { height: 16 },
  leyenda: { gap: spacing.sm },
  filaLeyenda: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  puntoLeyenda: { width: 10, height: 10, borderRadius: 5 },
  textoLeyenda: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  valorLeyenda: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    minWidth: 24,
    textAlign: 'right',
  },
  porcentajeLeyenda: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    minWidth: 36,
    textAlign: 'right',
  },
  nota: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
    lineHeight: 18,
  },
  leyendaSeries: { flexDirection: 'row', gap: spacing.lg },
  itemSerie: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detalleDia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  detalleDiaFecha: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  detalleDiaTexto: { fontSize: fontSize.sm, color: colors.textPrimary },
  grafico: { flexDirection: 'row', gap: spacing.xs },
  ejeY: { justifyContent: 'space-between', width: 22 },
  textoEje: { fontSize: 10, color: colors.textSlate, textAlign: 'right' },
  zonaBarras: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineaGuia: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  grupoBarras: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  parBarras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barraVertical: {
    width: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  ejeX: { flexDirection: 'row', marginLeft: 26 },
  textoEjeX: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colors.textSlate,
  },
  textoEjeXActivo: { color: colors.navy, fontWeight: fontWeight.bold },
  listaGravedad: { gap: spacing.sm },
  filaGravedad: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  etiquetaGravedad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 72,
  },
  pistaGravedad: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rellenoGravedad: { height: 10, borderRadius: 5 },
  opinion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  valorOpinion: {
    fontSize: 40,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  textosOpinion: { gap: 4 },
  estrellas: { flexDirection: 'row', gap: 2 },
  filaDesempeno: { flexDirection: 'row', alignItems: 'stretch' },
  desempeno: { flex: 1, gap: 2 },
  valorDesempeno: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#6250d6',
  },
  separadorVertical: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  cambio: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
