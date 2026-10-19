import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  htmlDelMapa,
  leerMensajeMapa,
  type PropsMapa,
  type RutaEnMapa,
} from './mapaLeaflet';

export type { PoiEnMapa, RutaEnMapa } from './mapaLeaflet';

/**
 * Mapa U06/U07 sobre Leaflet dentro de WebView (alternativa nativa de
 * `react-native-maps` para Expo Go).
 *
 * Por qué: el mapa nativo con tiles OSM (`mapType="none"` + `UrlTile`)
 * dejó el lienzo vacío en un Android real y siguió intermitente en Expo Go.
 * Leaflet en WebView pinta tiles OpenStreetMap con UA de navegador
 * (aceptados por OSM) y no depende de API keys ni de binarios nativos de
 * Expo Go (decisión documentada en `mobile-app/README.md`).
 *
 * Protocolo de mensajes:
 *   WebView → nativo `{ tipo: 'listo' }` · `{ tipo: 'poi', id }`
 *   nativo → WebView `window.renderizar(pois, ruta, yo, ajustar)`,
 *             `window.centrar(lat, lng)`
 */

export function MapaWeb({
  pois,
  vistaInicial,
  ruta = null,
  ubicacionUsuario = null,
  centrar = null,
  ajustarAlCambiar = true,
  onPoiPulsado,
  onListo,
}: PropsMapa) {
  const referencia = useRef<WebView | null>(null);
  const listoRef = useRef(false);
  const [listo, setListo] = useState(false);
  // Lives en refs: evitan reconstruir el callback del mensaje (y el WebView).
  const manejarPoiRef = useRef(onPoiPulsado);
  const onListoRef = useRef(onListo);
  useEffect(() => {
    manejarPoiRef.current = onPoiPulsado;
    onListoRef.current = onListo;
  }, [onPoiPulsado, onListo]);

  const html = useMemo(
    () =>
      htmlDelMapa({
        latitude: vistaInicial.latitude,
        longitude: vistaInicial.longitude,
      }),
    [vistaInicial.latitude, vistaInicial.longitude],
  );

  const manejarMensaje = useCallback((evento: WebViewMessageEvent) => {
    const datos = leerMensajeMapa(evento.nativeEvent.data);
    if (datos?.tipo === 'listo' && !listoRef.current) {
      listoRef.current = true;
      setListo(true);
      onListoRef.current?.();
      return;
    }
    if (datos?.tipo === 'poi') {
      manejarPoiRef.current(datos.id);
    }
  }, []);

  // Empuja el estado visible completo al mapa: al quedar listo y en cada
  // cambio. El encuadre se reajusta cuando aparece o cambia una ruta.
  const rutaPreviaRef = useRef<RutaEnMapa | null>(null);
  useEffect(() => {
    if (!listo) {
      return;
    }
    const hayRuta = (ruta?.coordenadas.length ?? 0) > 1;
    const rutaCambio =
      ruta !== rutaPreviaRef.current && ruta?.coordenadas != null;
    rutaPreviaRef.current = ruta;
    const ajustar = ajustarAlCambiar && hayRuta && rutaCambio;
    const poisJson = JSON.stringify(pois);
    const rutaJson = JSON.stringify(ruta?.coordenadas ?? null);
    const yoJson = JSON.stringify(ubicacionUsuario);
    referencia.current?.injectJavaScript(
      `window.renderizar(${poisJson}, ${rutaJson}, ${yoJson}, ${ajustar}); true;`,
    );
  }, [listo, pois, ruta, ubicacionUsuario, ajustarAlCambiar]);

  // Cambio de cámara (búsqueda / mi ubicación) cuando la clave cambia.
  useEffect(() => {
    if (!listo || !centrar) {
      return;
    }
    referencia.current?.injectJavaScript(
      `window.centrar(${centrar.latitude}, ${centrar.longitude}); true;`,
    );
  }, [listo, centrar]);

  return (
    <View style={estilos.contenedor}>
      <WebView
        ref={referencia}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        onMessage={manejarMensaje}
        style={estilos.webview}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#E8EEF4',
  },
});
