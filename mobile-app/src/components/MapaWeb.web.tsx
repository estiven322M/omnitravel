import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  htmlDelMapa,
  leerMensajeMapa,
  type PoiEnMapa,
  type PropsMapa,
  type RutaEnMapa,
} from './mapaLeaflet';

export type { PoiEnMapa, RutaEnMapa } from './mapaLeaflet';

/** Funciones que la página del mapa expone en su `window`. */
interface VentanaMapa extends Window {
  renderizar?: (
    pois: PoiEnMapa[],
    ruta: RutaEnMapa['coordenadas'] | null,
    yo: { latitude: number; longitude: number } | null,
    ajustar: boolean,
  ) => void;
  centrar?: (lat: number, lng: number) => void;
}

/**
 * Versión para navegador de `MapaWeb.tsx`: `react-native-webview` no existe
 * en web, así que el mismo mapa Leaflet se pinta en un `<iframe srcdoc>`.
 * El iframe comparte el origen de la app, por lo que se le llaman sus
 * funciones directamente y él responde con `postMessage`.
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
  const marco = useRef<HTMLIFrameElement | null>(null);
  const listoRef = useRef(false);
  const [listo, setListo] = useState(false);
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

  const ventana = (): VentanaMapa | null =>
    (marco.current?.contentWindow as VentanaMapa | null) ?? null;

  const marcarListo = () => {
    if (listoRef.current || !ventana()?.renderizar) {
      return;
    }
    listoRef.current = true;
    setListo(true);
    onListoRef.current?.();
  };

  useEffect(() => {
    const alRecibir = (evento: MessageEvent) => {
      if (evento.source !== marco.current?.contentWindow) {
        return;
      }
      const datos = leerMensajeMapa(evento.data);
      if (datos?.tipo === 'listo') {
        marcarListo();
      } else if (datos?.tipo === 'poi') {
        manejarPoiRef.current(datos.id);
      }
    };
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
    // marcarListo solo usa refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    ventana()?.renderizar?.(
      pois,
      ruta?.coordenadas ?? null,
      ubicacionUsuario,
      ajustar,
    );
  }, [listo, pois, ruta, ubicacionUsuario, ajustarAlCambiar]);

  useEffect(() => {
    if (!listo || !centrar) {
      return;
    }
    ventana()?.centrar?.(centrar.latitude, centrar.longitude);
  }, [listo, centrar]);

  return (
    <View style={estilos.contenedor}>
      <iframe
        ref={marco}
        srcDoc={html}
        title="Mapa de lugares accesibles"
        onLoad={marcarListo}
        style={{ border: 0, width: '100%', height: '100%', flex: 1 }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#E8EEF4',
  },
});
