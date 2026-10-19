/**
 * Piezas comunes del mapa Leaflet (U06/U07): tipos, HTML de la página del
 * mapa y protocolo de mensajes. Las usan `MapaWeb.tsx` (WebView en el
 * teléfono) y `MapaWeb.web.tsx` (iframe en el navegador).
 *
 * Protocolo:
 *   mapa → app `{ tipo: 'listo' }` · `{ tipo: 'poi', id }`
 *   app → mapa `window.renderizar(pois, ruta, yo, ajustar)`,
 *              `window.centrar(lat, lng)`
 */

export interface PoiEnMapa {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  /** POI resaltado (por ejemplo, el destino seleccionado). */
  activo: boolean;
  /** Aún en validación comunitaria (marcador azul). */
  pendiente: boolean;
  /**
   * Barrera reportada por la comunidad (marcador naranja con aviso):
   * escaleras, aceras rotas, ascensores dañados…
   */
  barrera?: boolean;
  /** Texto del globo cuando es una barrera (qué se reportó). */
  descripcion?: string;
  /** Miniatura (data URI) para la tarjeta del mockup U06. */
  foto?: string;
  /** Segunda línea de la tarjeta («A 5 min»). */
  detalle?: string;
  /** Lugar accesible verificado (sello «♿ Accesible»). */
  accesible?: boolean;
}

export interface RutaEnMapa {
  /** Secuencia de puntos (lat/long) del resultado del backend de rutas. */
  coordenadas: { latitude: number; longitude: number }[];
}

export interface PropsMapa {
  pois: PoiEnMapa[];
  vistaInicial: { latitude: number; longitude: number };
  ruta?: RutaEnMapa | null;
  ubicacionUsuario?: { latitude: number; longitude: number } | null;
  /** Cambia la cámara (búsqueda / mi ubicación); `clave` fuerza el re-centrado. */
  centrar?: { latitude: number; longitude: number; clave: number } | null;
  /** Ajusta el encuadre a los puntos cada vez que cambia el conjunto. */
  ajustarAlCambiar?: boolean;
  onPoiPulsado: (idPoi: string) => void;
  /** Avisa una sola vez cuando Leaflet quedó listo dentro del WebView. */
  onListo?: () => void;
}

export const HTML_MAPA = `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>Mapa OmniTravel</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css"/>
<style>
html,body,#mapa{height:100%;margin:0;padding:0;}
#mapa{background:#E8EEF4;}
.leaflet-container{font-family:-apple-system,Roboto,'Helvetica Neue',sans-serif;}
.barrera-icono{font-size:13px;line-height:22px;text-align:center;color:#FFFFFF;font-weight:bold;}
.pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #FFF;box-shadow:0 2px 5px rgba(16,24,40,.35);display:flex;align-items:center;justify-content:center;}
.pin span{transform:rotate(45deg);color:#FFF;font-size:14px;font-weight:bold;}
.leaflet-tooltip.tarjeta{padding:4px;border:none;border-radius:8px;box-shadow:0 2px 8px rgba(16,24,40,.18);}
.tarjeta .fila{display:flex;gap:6px;align-items:center;}
.tarjeta img{width:40px;height:40px;border-radius:6px;object-fit:cover;}
.tarjeta b{display:block;font-size:11px;color:#0B1B3F;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tarjeta small{display:block;font-size:10px;color:#5B6B86;}
.tarjeta .ok{color:#0E7F43;}
.tarjeta .alerta{color:#C2410C;}
</style>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
</head><body><div id="mapa"></div>
<script>
var mapa = L.map('mapa', { zoomControl: false });
mapa.setView([__LAT__, __LON__], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright" style="color:#4B5563">OpenStreetMap</a>'
}).addTo(mapa);
var capas = { pois: null, ruta: null, yo: null };
window.centrar = function(lat, lng) {
  mapa.flyTo([lat, lng], 16, { duration: 0.7 });
};
function enviar(json) {
  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(json); }
  else if (window.parent && window.parent !== window) { window.parent.postMessage(json, '*'); }
}
enviar(JSON.stringify({ tipo: 'listo' }));
function escapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function tarjeta(p) {
  var foto = p.foto && p.foto.indexOf('data:image/') === 0 ? '<img src="' + p.foto + '"/>' : '';
  var lineas = '<b>' + escapar(p.nombre) + '</b>';
  if (p.barrera) {
    lineas += '<small class="alerta">Reportada por la comunidad</small>';
  } else {
    if (p.detalle) { lineas += '<small>' + escapar(p.detalle) + '</small>'; }
    lineas += p.accesible ? '<small class="ok">♿ Accesible</small>' : '<small>En validación</small>';
  }
  return '<div class="fila">' + foto + '<div>' + lineas + '</div></div>';
}
window.renderizar = function(pois, ruta, yo, ajustar) {
  var grupo = L.featureGroup();
  pois.forEach(function(p) {
    var marca;
    if (p.barrera) {
      marca = L.marker([p.latitud, p.longitud], {
        icon: L.divIcon({
          className: '',
          html: '<div class="barrera-icono" style="width:24px;height:24px;border-radius:50%;background:#F57B15;border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(16,24,40,.4)">!</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      });
      marca.bindTooltip(tarjeta({ nombre: p.descripcion || p.nombre, barrera: true }),
        { direction: 'top', offset: [0, -12], permanent: true, className: 'tarjeta' });
    } else {
      var color = p.activo ? '#0455BE' : (p.pendiente ? '#F57B15' : '#0E7F43');
      marca = L.marker([p.latitud, p.longitud], {
        icon: L.divIcon({
          className: '',
          html: '<div class="pin" style="background:' + color + '"><span>' + (p.pendiente ? '?' : '✓') + '</span></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        })
      });
      marca.bindTooltip(tarjeta(p),
        { direction: 'top', offset: [0, -30], permanent: true, className: 'tarjeta' });
    }
    marca.on('click', function() {
      enviar(JSON.stringify({ tipo: 'poi', id: String(p.id) }));
    });
    grupo.addLayer(marca);
  });
  if (capas.pois) { mapa.removeLayer(capas.pois); }
  capas.pois = grupo;
  grupo.addTo(mapa);
  var hayRuta = ruta && ruta.length > 1;
  if (hayRuta) {
    if (capas.ruta) { mapa.removeLayer(capas.ruta); }
    capas.ruta = L.polyline(ruta.map(function(c) { return [c.latitude, c.longitude]; }),
      { color: '#0455BE', weight: 4, opacity: 0.9 }).addTo(mapa);
  } else if (capas.ruta) {
    mapa.removeLayer(capas.ruta);
    capas.ruta = null;
  }
  if (yo) {
    if (capas.yo) { mapa.removeLayer(capas.yo); }
    capas.yo = L.circleMarker([yo.latitude, yo.longitude],
      { radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#0288D1', fillOpacity: 1 }).addTo(mapa);
  } else if (capas.yo) {
    mapa.removeLayer(capas.yo);
    capas.yo = null;
  }
  if (ajustar === true) {
    var caja = hayRuta ? capas.ruta.getBounds() : grupo.getBounds();
    if (caja && caja.isValid && caja.isValid()) {
      mapa.fitBounds(caja, { padding: [40, 40] });
    }
  }
};
</script></body></html>`;

/** HTML del mapa centrado en la vista inicial. */
export function htmlDelMapa(vista: { latitude: number; longitude: number }) {
  return HTML_MAPA.replace('__LAT__', String(vista.latitude)).replace(
    '__LON__',
    String(vista.longitude),
  );
}

/** Lee un mensaje del mapa; null si no es del protocolo. */
export function leerMensajeMapa(
  crudo: unknown,
): { tipo: 'listo' } | { tipo: 'poi'; id: string } | null {
  if (typeof crudo !== 'string') {
    return null;
  }
  try {
    const datos = JSON.parse(crudo) as { tipo?: string; id?: unknown };
    if (datos.tipo === 'listo') {
      return { tipo: 'listo' };
    }
    if (datos.tipo === 'poi' && typeof datos.id === 'string') {
      return { tipo: 'poi', id: datos.id };
    }
  } catch {
    return null;
  }
  return null;
}
