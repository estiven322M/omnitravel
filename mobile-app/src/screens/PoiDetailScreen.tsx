import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccessibilityValueRow } from '../components/AccessibilityValueRow';
import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import { Card } from '../components/Card';
import { DenunciarReporte } from '../components/DenunciarReporte';
import { ConsensoAlcanzado } from '../components/ConsensoAlcanzado';
import { EmptyState } from '../components/EmptyState';
import type { RootStackParamList } from '../navigation/types';
import { CATALOGO_CARACTERISTICAS } from '../services/mocks/catalog';
import { fotosDelLugar, type FotoPoi } from '../services/mocks/fotosPoi';
import {
  experienciasDePoi,
  visitasPendientes,
  type VisitaPendiente,
} from '../services/api/feedback';
import {
  confirmarReporte,
  obtenerReporteDePoi,
  ReporteError,
} from '../services/reportes';
import type { ExperienciaViajero, ReporteComunitario } from '../services/types';
import { useFavoritosStore } from '../store/favoritosStore';
import { usePoisStore } from '../store/poisStore';
import { useProfileStore } from '../store/profileStore';
import { usaPanelModeracion } from '../services/inicioSesion';
import { formatearFechaCorta } from '../utils/format';
import {
  colors,
  fontSize,
  fontWeight,
  radii,
  spacing,
  TOUCH_TARGET,
} from '../utils/theme';

function Estrellas({ calificacion }: { calificacion: number }) {
  return (
    <View
      style={estilos.estrellas}
      accessible
      accessibilityLabel={`Calificación ${calificacion} de 5`}
    >
      {[1, 2, 3, 4, 5].map((indice) => (
        <Ionicons
          key={indice}
          name={indice <= Math.round(calificacion) ? 'star' : 'star-outline'}
          size={13}
          color="#F5B301"
        />
      ))}
    </View>
  );
}

/**
 * U08 — Detalle del Lugar Turístico.
 * Ficha de accesibilidad renderizada dinámicamente según el catálogo
 * (tipoValor booleano/numérico/texto) + estado de verificación comunitaria.
 */
export function PoiDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DetallePoi'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const poiPorId = usePoisStore((estado) => estado.poiPorId);
  const poisCargados = usePoisStore((estado) => estado.cargado);
  const cargarPois = usePoisStore((estado) => estado.cargar);
  const poiId = route.params.poiId;
  const enPanelModeracion = useProfileStore((estado) =>
    usaPanelModeracion(estado.perfil),
  );

  // Guardados (favorito en la BD del equipo): corazón de la barra superior.
  const esFavorito = useFavoritosStore((estado) => estado.ids.includes(poiId));
  const favoritoCargado = useFavoritosStore((estado) => estado.cargado);
  const cargarFavoritos = useFavoritosStore((estado) => estado.cargar);
  const alternarFavorito = useFavoritosStore((estado) => estado.alternar);

  // Reintenta la carga si la pantalla se abrió antes de tener datos.
  useEffect(() => {
    if (!poisCargados) {
      void cargarPois();
    }
  }, [poisCargados, cargarPois]);

  const [reporte, setReporte] = useState<ReporteComunitario | null | undefined>(
    undefined,
  );
  const [confirmando, setConfirmando] = useState(false);
  const [yaConfirme, setYaConfirme] = useState(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(
    null,
  );
  const [s01Visible, setS01Visible] = useState(false);
  const [denunciaVisible, setDenunciaVisible] = useState(false);
  const [guardandoFavorito, setGuardandoFavorito] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const [experiencias, setExperiencias] = useState<ExperienciaViajero[] | null>(
    null,
  );
  const [resumenExperiencias, setResumenExperiencias] = useState<{
    total: number;
    promedio: number;
  } | null>(null);

  // Carga el listado de favoritos para el estado del corazón (una sola vez).
  useEffect(() => {
    if (!favoritoCargado) {
      void cargarFavoritos();
    }
  }, [favoritoCargado, cargarFavoritos]);

  // Reporte vigente del punto: habilita la confirmación comunitaria (C3).
  // `undefined` = cargando; `null` = el punto aún no tiene reportes.
  useEffect(() => {
    let vigente = true;
    if (!poisCargados) {
      return undefined;
    }
    obtenerReporteDePoi(poiId)
      .then((activo) => {
        if (vigente) {
          setReporte(activo);
        }
      })
      .catch(() => {
        if (vigente) {
          setReporte(null);
        }
      });
    return () => {
      vigente = false;
    };
  }, [poiId, poisCargados]);

  /**
   * Proceso 3: refresca las experiencias públicas al volver a la ficha
   * (por ejemplo, después de calificar una visita). El endpoint no expone
   * correos ni datos del perfil local.
   */
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      experienciasDePoi(poiId)
        .then((datos) => {
          if (!vigente) {
            return;
          }
          setExperiencias(
            datos.experiencias.map((experiencia) => ({
              id: experiencia.id,
              autor: experiencia.autor,
              perfil: experiencia.perfil,
              calificacion: experiencia.calificacion,
              comentario: experiencia.comentario,
              fecha: experiencia.fecha,
            })),
          );
          setResumenExperiencias({
            total: datos.total,
            promedio: datos.promedio,
          });
        })
        .catch(() => {
          // La ficha conserva las experiencias que ya trajo el mapa.
        });
      return () => {
        vigente = false;
      };
    }, [poiId]),
  );

  /**
   * Proceso 3 — solo se califica una visita COMPLETADA: la que se cierra al
   * terminar la navegación hasta el lugar («Finalizar ruta», U07) y aún no
   * tiene calificación. Sin ella el botón queda deshabilitado y lo explica.
   */
  const [visitaPorCalificar, setVisitaPorCalificar] = useState<
    VisitaPendiente | null | undefined
  >(undefined);
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      visitasPendientes()
        .then((lista) => {
          if (vigente) {
            setVisitaPorCalificar(
              lista.find((visita) => String(visita.poi_id) === poiId) ?? null,
            );
          }
        })
        .catch(() => {
          if (vigente) {
            setVisitaPorCalificar(null);
          }
        });
      return () => {
        vigente = false;
      };
    }, [poiId]),
  );
  const calificarVisita = () => {
    if (!visitaPorCalificar) {
      return;
    }
    navigation.navigate('Feedback', {
      visitaId: visitaPorCalificar.id_visita,
      poiId,
      poiNombre: visitaPorCalificar.poi_nombre,
    });
  };

  const poi = poiPorId(poiId);

  if (!poi) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EmptyState
          icono="alert-circle-outline"
          titulo="Lugar no encontrado"
          descripcion="No pudimos cargar la información de este lugar."
          textoBoton="Volver"
          onPressBoton={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const verificado = poi.estadoVerificacion === 'VERIFICADO';
  const listaExperiencias = experiencias ?? poi.experiencias;
  const totalOpiniones = resumenExperiencias?.total ?? poi.totalExperiencias;
  const calificacionMostrada =
    resumenExperiencias?.promedio ?? poi.calificacion;
  const cargandoReporte = reporte === undefined;
  const reporteActivo = reporte ?? null;
  const reporteConfirmable =
    reporteActivo?.estado === 'pendiente_validacion' ||
    reporteActivo?.estado === 'pendiente'; // 'pendiente': formato heredado

  /**
   * C3 — suma una confirmación comunitaria. A la tercera de usuarios
   * independientes la BD publica el punto y se abre el modal S01.
   */
  const confirmarAccesibilidad = async () => {
    if (!reporteActivo || confirmando) {
      return;
    }
    setConfirmando(true);
    setMensajeConfirmacion(null);
    try {
      const resultado = await confirmarReporte(reporteActivo.id);
      setReporte((anterior) =>
        anterior
          ? {
              ...anterior,
              confirmaciones: resultado.confirmaciones,
              estado: resultado.publicado ? 'publicado' : anterior.estado,
            }
          : anterior,
      );
      if (resultado.publicado) {
        setS01Visible(true);
        void cargarPois();
      } else {
        setMensajeConfirmacion(
          `¡Gracias! Este lugar suma ${resultado.confirmaciones} de 3 confirmaciones.`,
        );
      }
    } catch (error) {
      const mensaje = (error as Error).message;
      if (
        error instanceof ReporteError &&
        error.codigo === 'CONFIRMACION_DUPLICADA'
      ) {
        setYaConfirme(true);
      }
      setMensajeConfirmacion(mensaje);
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(mensaje);
      }
    } finally {
      setConfirmando(false);
    }
  };

  /** Alterna Guardados (favorito) con rollback si la BD rechaza la operación. */
  const alternarGuardado = async () => {
    if (guardandoFavorito) {
      return;
    }
    setGuardandoFavorito(true);
    setMensajeConfirmacion(null);
    try {
      await alternarFavorito(poiId);
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          esFavorito
            ? `${poi.nombre} quitado de guardados`
            : `${poi.nombre} guardado en favoritos`,
        );
      }
    } catch (error) {
      const mensaje = (error as Error).message;
      setMensajeConfirmacion(mensaje);
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(mensaje);
      }
    } finally {
      setGuardandoFavorito(false);
    }
  };

  const fotos = fotosDelLugar(poi);
  const confirmados = CATALOGO_CARACTERISTICAS.filter((caracteristica) => {
    const valor = poi.valores.find(
      (v) => v.caracteristicaId === caracteristica.id,
    );
    if (!valor) {
      return false;
    }
    if (caracteristica.id === 'tiene_escaleras') {
      return valor.valorBooleano === false;
    }
    if (caracteristica.tipoValor === 'NUMERICO') {
      return (valor.valorNumerico ?? 0) > 0;
    }
    return valor.valorBooleano === true;
  });

  const compartir = () => {
    void Share.share({
      message: `${poi.nombre} (${poi.categoria}, ${poi.ciudad}) en OmniTravel: ${
        verificado ? 'accesibilidad verificada' : 'en revisión por la comunidad'
      }.`,
    });
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.barraNavegacion}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={estilos.botonBarra}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <View style={estilos.marcaBarra}>
          <BrandMark variante="completo" tamano={34} />
        </View>
        <Pressable
          onPress={() => void alternarGuardado()}
          style={estilos.botonBarra}
          accessibilityRole="button"
          accessibilityLabel={
            esFavorito
              ? `Quitar ${poi.nombre} de guardados`
              : `Guardar ${poi.nombre} en favoritos`
          }
          accessibilityHint="Se sincroniza con tu lista de lugares guardados"
          disabled={guardandoFavorito}
        >
          <Ionicons
            name={esFavorito ? 'heart' : 'heart-outline'}
            size={26}
            color={esFavorito ? colors.danger : colors.primary}
          />
        </Pressable>
        <Pressable
          onPress={compartir}
          style={estilos.botonBarra}
          accessibilityRole="button"
          accessibilityLabel={`Compartir ${poi.nombre}`}
        >
          <Ionicons
            name="share-social-outline"
            size={24}
            color={colors.primary}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        <GaleriaFotos fotos={fotos} nombre={poi.nombre} />

        <View style={estilos.cuerpo}>
          <View style={estilos.encabezado}>
            <View style={estilos.filaNombre}>
              <Text style={estilos.nombre} accessibilityRole="header">
                {poi.nombre}
              </Text>
              <View
                style={estilos.filaCalificacion}
                accessible
                accessibilityLabel={`Calificación ${calificacionMostrada.toFixed(
                  1,
                )} de 5, ${totalOpiniones} opiniones`}
              >
                <Ionicons name="star" size={18} color="#F5B301" />
                <Text style={estilos.calificacion}>
                  {calificacionMostrada.toFixed(1)}
                </Text>
                <Text style={estilos.totalOpiniones}>({totalOpiniones})</Text>
              </View>
            </View>
            <Text style={estilos.subtitulo}>
              {poi.categoria} • {poi.ciudad}
            </Text>
            <View style={estilos.filaDireccion}>
              <Ionicons name="location" size={15} color={colors.primary} />
              <Text style={estilos.direccion}>{poi.direccion}</Text>
            </View>
          </View>

          <View
            style={[
              estilos.tarjetaVerificacion,
              verificado ? null : estilos.tarjetaPendiente,
            ]}
            accessible
            accessibilityLabel={`${
              verificado
                ? 'Accesibilidad verificada'
                : 'En revisión por la comunidad'
            }, ${poi.confirmaciones} confirmaciones. Última verificación ${formatearFechaCorta(
              poi.ultimaVerificacion,
            )}`}
          >
            <Ionicons
              name={verificado ? 'checkmark-circle' : 'time'}
              size={34}
              color={verificado ? colors.success : colors.warning}
            />
            <View style={estilos.textosVerificacion}>
              <Text
                style={[
                  estilos.tituloVerificacion,
                  verificado ? null : estilos.tituloPendiente,
                ]}
              >
                {verificado
                  ? 'Accesibilidad Verificada'
                  : 'En revisión por la comunidad'}
              </Text>
              <Text style={estilos.detalleVerificacion}>
                ({poi.confirmaciones} confirmaciones de la comunidad)
              </Text>
            </View>
            <View style={estilos.fechaVerificacion}>
              <Text style={estilos.detalleFecha}>Última verificación</Text>
              <Text style={estilos.detalleFecha}>
                {formatearFechaCorta(poi.ultimaVerificacion)}
              </Text>
            </View>
          </View>

          <View style={estilos.seccion}>
            <View style={estilos.filaTituloSeccion}>
              <Text style={estilos.tituloSeccion}>
                Características de accesibilidad
              </Text>
              <Pressable
                onPress={() => setVerTodas((actual) => !actual)}
                accessibilityRole="button"
                accessibilityState={{ expanded: verTodas }}
                hitSlop={8}
              >
                <Text style={estilos.enlace}>
                  {verTodas ? 'Ver menos' : 'Ver todas'}
                </Text>
              </Pressable>
            </View>
            {confirmados.length > 0 ? (
              <View style={estilos.mosaico}>
                {confirmados.slice(0, 4).map((caracteristica) => (
                  <View
                    key={caracteristica.id}
                    style={estilos.ficha}
                    accessible
                    accessibilityLabel={`${caracteristica.nombre}: confirmado`}
                  >
                    <Ionicons
                      name={caracteristica.icono}
                      size={20}
                      color={colors.navy}
                    />
                    <Text style={estilos.fichaTexto} numberOfLines={2}>
                      {caracteristica.nombre}
                    </Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.success}
                      style={estilos.fichaCheck}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={estilos.sinExperiencias}>
                La comunidad aún no confirma características de este lugar.
              </Text>
            )}
            {verTodas ? (
              <Card>
                {CATALOGO_CARACTERISTICAS.map((caracteristica) => (
                  <AccessibilityValueRow
                    key={caracteristica.id}
                    caracteristica={caracteristica}
                    valor={poi.valores.find(
                      (valor) => valor.caracteristicaId === caracteristica.id,
                    )}
                  />
                ))}
              </Card>
            ) : null}
          </View>

          <View style={estilos.botones}>
            <AppButton
              titulo={'Cómo llegar\n(Ruta Segura)'}
              icono="navigate"
              onPress={() =>
                // Moderación y viajeros tienen pestañas distintas.
                enPanelModeracion
                  ? navigation.navigate('PanelModerador', {
                      screen: 'Mapa',
                      params: { destinoPoiId: poi.id },
                    })
                  : navigation.navigate('Principal', {
                      screen: 'Mapa',
                      params: { destinoPoiId: poi.id },
                    })
              }
              forma="redondeado"
              estilo={estilos.boton}
            />
            <AppButton
              titulo={yaConfirme ? 'Ya validaste' : 'Validar información'}
              variante="contorno"
              icono="people"
              cargando={cargandoReporte || confirmando}
              deshabilitado={!reporteConfirmable || yaConfirme || confirmando}
              onPress={() => void confirmarAccesibilidad()}
              pistaAccesibilidad="Suma tu confirmación: con 3, la comunidad publica el lugar"
              forma="redondeado"
              estilo={estilos.boton}
            />
          </View>
          {!enPanelModeracion ? (
            <>
              <AppButton
                titulo="Calificar mi visita"
                variante="fantasma"
                icono="star-outline"
                cargando={visitaPorCalificar === undefined}
                deshabilitado={!visitaPorCalificar}
                onPress={calificarVisita}
                pistaAccesibilidad="Abre la calificación de tu visita completada"
              />
              {visitaPorCalificar === null ? (
                <Text style={estilos.ayudaCalificar}>
                  Podrás calificar este lugar cuando completes una visita: pulsa
                  «Cómo llegar» y termina la navegación hasta aquí.
                </Text>
              ) : null}
            </>
          ) : null}
          {reporteConfirmable ? (
            <Text
              style={estilos.progresoConfirmaciones}
              accessibilityLiveRegion="polite"
            >
              {reporte?.confirmaciones ?? 0} de 3 confirmaciones para publicar
            </Text>
          ) : null}
          {reporteActivo?.estado === 'en_revision' ? (
            <Text
              style={estilos.progresoConfirmaciones}
              accessibilityLiveRegion="polite"
            >
              Este reporte fue denunciado: moderación lo está revisando.
            </Text>
          ) : null}
          {reporteActivo &&
          !enPanelModeracion &&
          reporteActivo.estado !== 'en_revision' &&
          reporteActivo.estado !== 'rechazado' ? (
            <AppButton
              titulo="Denunciar este reporte"
              variante="fantasma"
              icono="flag-outline"
              onPress={() => setDenunciaVisible(true)}
              pistaAccesibilidad="Avisa a moderación si el reporte es falso o spam"
            />
          ) : null}
          {!reporteConfirmable &&
          !verificado &&
          !cargandoReporte &&
          reporteActivo?.estado !== 'en_revision' ? (
            <Text style={estilos.sinReporte}>
              Aún no hay un reporte activo de la comunidad para este lugar.
            </Text>
          ) : null}
          {mensajeConfirmacion ? (
            <Text
              style={estilos.mensajeConfirmacion}
              accessibilityLiveRegion="polite"
            >
              {mensajeConfirmacion}
            </Text>
          ) : null}

          <View style={estilos.seccion}>
            <View style={estilos.filaTituloSeccion}>
              <Text style={estilos.tituloSeccion}>
                Experiencias de otros viajeros
              </Text>
              {listaExperiencias.length > 0 ? (
                <Text style={estilos.enlace}>
                  Ver todas ({listaExperiencias.length})
                </Text>
              ) : null}
            </View>
            {listaExperiencias.length === 0 ? (
              <Text style={estilos.sinExperiencias}>
                Aún no hay experiencias registradas para este lugar.
              </Text>
            ) : (
              listaExperiencias.map((experiencia, indice) => (
                <View
                  key={experiencia.id ?? `${experiencia.autor}-${indice}`}
                  style={estilos.tarjetaExperiencia}
                >
                  <View style={estilos.avatar}>
                    <Text style={estilos.avatarInicial}>
                      {experiencia.autor.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={estilos.textosExperiencia}>
                    <View style={estilos.filaAutor}>
                      <Text style={estilos.autor}>{experiencia.autor}</Text>
                      {experiencia.calificacion >= 4 ? (
                        <View style={estilos.sello}>
                          <Ionicons
                            name="thumbs-up"
                            size={11}
                            color={colors.success}
                          />
                          <Text style={estilos.selloTexto}>
                            Experiencia positiva
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={estilos.perfilExperiencia}>
                      {experiencia.perfil}
                    </Text>
                    <Estrellas calificacion={experiencia.calificacion} />
                    <Text style={estilos.comentario}>
                      {experiencia.comentario}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {reporteActivo ? (
        <DenunciarReporte
          visible={denunciaVisible}
          reporteId={reporteActivo.id}
          poiNombre={poi.nombre}
          onCerrar={() => setDenunciaVisible(false)}
          onDenunciado={() => {
            setDenunciaVisible(false);
            setReporte((anterior) =>
              anterior ? { ...anterior, estado: 'en_revision' } : anterior,
            );
            setMensajeConfirmacion(
              'Gracias. Tu denuncia llegó a moderación y el reporte quedó en revisión.',
            );
          }}
        />
      ) : null}

      <ConsensoAlcanzado
        visible={s01Visible}
        poiNombre={poi.nombre}
        onCerrar={() => setS01Visible(false)}
      />
    </SafeAreaView>
  );
}

/** Galería del mockup U08: foto grande con contador y miniaturas con leyenda. */
function GaleriaFotos({ fotos, nombre }: { fotos: FotoPoi[]; nombre: string }) {
  const [indice, setIndice] = useState(0);
  const actual = fotos[indice] ?? fotos[0];
  return (
    <View>
      <View>
        <Image
          source={actual.fuente}
          style={estilos.heroe}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={`${actual.leyenda} de ${nombre}${
            actual.referencia ? ' (foto de referencia)' : ''
          }`}
          accessibilityIgnoresInvertColors
        />
        <View style={estilos.contador}>
          <Text style={estilos.contadorTexto}>
            {indice + 1}/{fotos.length}
          </Text>
        </View>
        {actual.referencia ? (
          <View style={estilos.referencia}>
            <Text style={estilos.referenciaTexto}>Foto de referencia</Text>
          </View>
        ) : null}
        {actual.credito ? (
          <View style={estilos.credito}>
            <Text style={estilos.creditoTexto} numberOfLines={1}>
              Foto: {actual.credito}
            </Text>
          </View>
        ) : null}
      </View>
      {fotos.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.miniaturas}
        >
          {fotos.map((foto, i) => (
            <Pressable
              key={foto.clave}
              onPress={() => setIndice(i)}
              accessibilityRole="button"
              accessibilityLabel={`Ver foto: ${foto.leyenda}`}
              accessibilityState={{ selected: i === indice }}
              style={estilos.miniatura}
            >
              <Image
                source={foto.fuente}
                style={[
                  estilos.miniaturaImagen,
                  i === indice ? estilos.miniaturaActiva : null,
                ]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <Text
                style={[
                  estilos.miniaturaLeyenda,
                  i === indice ? estilos.miniaturaLeyendaActiva : null,
                ]}
              >
                {foto.leyenda}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  credito: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '75%',
    backgroundColor: 'rgba(16, 24, 40, 0.6)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  creditoTexto: { color: colors.white, fontSize: 10 },
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  barraNavegacion: {
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  marcaBarra: {
    flex: 1,
    alignItems: 'flex-start',
  },
  botonBarra: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: {
    paddingBottom: spacing.xxl,
  },
  cuerpo: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroe: {
    width: '100%',
    height: 230,
    backgroundColor: colors.surface,
  },
  contador: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(16, 24, 40, 0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  contadorTexto: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  referencia: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(16, 24, 40, 0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  referenciaTexto: {
    color: colors.white,
    fontSize: 11,
  },
  miniaturas: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  miniatura: {
    alignItems: 'center',
    gap: 4,
  },
  miniaturaImagen: {
    width: 76,
    height: 56,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniaturaActiva: {
    borderColor: colors.primary,
  },
  miniaturaLeyenda: {
    fontSize: 11,
    color: colors.textSlate,
  },
  miniaturaLeyendaActiva: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  encabezado: {
    gap: 4,
  },
  filaNombre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nombre: {
    flex: 1,
    fontSize: fontSize.xxl - 4,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  filaCalificacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  estrellas: {
    flexDirection: 'row',
    gap: 2,
  },
  calificacion: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  totalOpiniones: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
  },
  filaDireccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  direccion: {
    fontSize: fontSize.sm,
    color: colors.textSlate,
  },
  tarjetaVerificacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: '#CDE8D6',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tarjetaPendiente: {
    backgroundColor: colors.warningSoft,
    borderColor: '#F8D9B5',
  },
  textosVerificacion: {
    flex: 1,
    gap: 2,
  },
  tituloVerificacion: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  tituloPendiente: {
    color: '#9A4A06',
  },
  detalleVerificacion: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  fechaVerificacion: {
    alignItems: 'flex-end',
  },
  detalleFecha: {
    fontSize: 11,
    color: colors.textSlate,
  },
  seccion: {
    gap: spacing.sm,
  },
  filaTituloSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloSeccion: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  enlace: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  mosaico: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ficha: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    minHeight: 52,
  },
  fichaTexto: {
    flex: 1,
    fontSize: 11,
    color: colors.navy,
  },
  fichaCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.white,
    borderRadius: 7,
  },
  botones: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  boton: {
    flex: 1,
  },
  ayudaCalificar: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  progresoConfirmaciones: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  sinReporte: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  mensajeConfirmacion: {
    fontSize: fontSize.sm,
    color: colors.success,
    textAlign: 'center',
    lineHeight: 20,
  },
  sinExperiencias: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tarjetaExperiencia: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInicial: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  textosExperiencia: {
    flex: 1,
    gap: 3,
  },
  filaAutor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  autor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.navy,
  },
  sello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  selloTexto: {
    fontSize: 10,
    color: colors.success,
    fontWeight: fontWeight.semibold,
  },
  perfilExperiencia: {
    fontSize: fontSize.xs,
    color: colors.textSlate,
  },
  comentario: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});
