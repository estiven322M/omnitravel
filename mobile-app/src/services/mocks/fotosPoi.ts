import type { ImageSourcePropType } from 'react-native';
import { MINIATURAS } from './miniaturasPoi';

/**
 * Fotos de los lugares (U04, U06, U08, Guardados).
 *
 * La BD del equipo todavía no almacena fotografías de los POI (la tabla
 * `evidencia` pertenece a reportes, no a lugares). Para que todas las vistas
 * conserven el diseño de los mockups oficiales:
 *
 * 1. Si el lugar se llama igual que uno de los mockups, usa SU foto.
 * 2. Si no, usa una foto de referencia de su categoría (restaurante, hotel,
 *    museo, parque, atracción). Las fotos de categoría no muestran letreros
 *    con nombres, para no confundir un lugar con otro.
 *
 * Todas son recortes de los propios mockups. Cuando la BD tenga fotos reales
 * por POI, basta con que `fotosDePoi` las devuelva primero.
 */

export interface FotoPoi {
  fuente: ImageSourcePropType;
  /** Nombre del archivo en assets/photos (también clave de la miniatura). */
  clave: string;
  /** Leyenda corta de la galería del detalle (U08). */
  leyenda: string;
  /** true: foto de la categoría, no del lugar exacto. */
  referencia: boolean;
}

const foto = {
  cafe: require('../../../assets/photos/cafe-del-parque.jpg'),
  museoQuindio: require('../../../assets/photos/museo-del-quindio.jpg'),
  hotelMocawa: require('../../../assets/photos/hotel-mocawa.jpg'),
  sabores: require('../../../assets/photos/restaurante-sabores.jpg'),
  restaurante: require('../../../assets/photos/restaurante.jpg'),
  restauranteMesas: require('../../../assets/photos/restaurante-mesas.jpg'),
  restauranteBano: require('../../../assets/photos/restaurante-bano.jpg'),
  hotel: require('../../../assets/photos/hotel.jpg'),
  museo: require('../../../assets/photos/museo.jpg'),
  parque: require('../../../assets/photos/parque.jpg'),
  mirador: require('../../../assets/photos/mirador.jpg'),
} satisfies Record<string, ImageSourcePropType>;

/** Galería del restaurante del mockup U08 (acceso, interior, baño, mesas). */
const GALERIA_RESTAURANTE = (
  portada: ImageSourcePropType,
  clave: string,
  referencia: boolean,
): FotoPoi[] => [
  { fuente: portada, clave, leyenda: 'Acceso', referencia },
  {
    fuente: foto.restaurante,
    clave: 'restaurante',
    leyenda: 'Interior',
    referencia: true,
  },
  {
    fuente: foto.restauranteBano,
    clave: 'restaurante-bano',
    leyenda: 'Baño adaptado',
    referencia: true,
  },
  {
    fuente: foto.restauranteMesas,
    clave: 'restaurante-mesas',
    leyenda: 'Zona de mesas',
    referencia: true,
  },
];

const FOTOS_POR_NOMBRE: Record<string, FotoPoi[]> = {
  'cafe del parque': GALERIA_RESTAURANTE(foto.cafe, 'cafe-del-parque', false),
  'sabores del parque': GALERIA_RESTAURANTE(
    foto.sabores,
    'restaurante-sabores',
    false,
  ),
  'museo del quindio': [
    {
      fuente: foto.museoQuindio,
      clave: 'museo-del-quindio',
      leyenda: 'Fachada',
      referencia: false,
    },
  ],
  'hotel mocawa': [
    {
      fuente: foto.hotelMocawa,
      clave: 'hotel-mocawa',
      leyenda: 'Fachada',
      referencia: false,
    },
  ],
};

const FOTOS_POR_CATEGORIA: Record<string, FotoPoi[]> = {
  restaurante: GALERIA_RESTAURANTE(foto.restaurante, 'restaurante', true),
  cafe: GALERIA_RESTAURANTE(foto.restaurante, 'restaurante', true),
  hotel: [
    {
      fuente: foto.hotel,
      clave: 'hotel',
      leyenda: 'Fachada',
      referencia: true,
    },
  ],
  museo: [
    {
      fuente: foto.museo,
      clave: 'museo',
      leyenda: 'Fachada',
      referencia: true,
    },
  ],
  'centro cultural': [
    {
      fuente: foto.museo,
      clave: 'museo',
      leyenda: 'Fachada',
      referencia: true,
    },
  ],
  parque: [
    {
      fuente: foto.parque,
      clave: 'parque',
      leyenda: 'Sendero',
      referencia: true,
    },
  ],
  atraccion: [
    {
      fuente: foto.mirador,
      clave: 'mirador',
      leyenda: 'Vista',
      referencia: true,
    },
  ],
  mirador: [
    {
      fuente: foto.mirador,
      clave: 'mirador',
      leyenda: 'Vista',
      referencia: true,
    },
  ],
};

/** Foto por defecto para categorías nuevas: el paisaje del mockup. */
const FOTOS_GENERICAS: FotoPoi[] = [
  {
    fuente: foto.mirador,
    clave: 'mirador',
    leyenda: 'Vista',
    referencia: true,
  },
];

/** Normaliza un texto (sin acentos, minúsculas) para la búsqueda. */
export function claveDeTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Todas las fotos del lugar, la primera es la portada. Nunca vacío. */
export function fotosDePoi(nombre: string, categoria: string): FotoPoi[] {
  return (
    FOTOS_POR_NOMBRE[claveDeTexto(nombre)] ??
    FOTOS_POR_CATEGORIA[claveDeTexto(categoria)] ??
    FOTOS_GENERICAS
  );
}

/** Portada del lugar (tarjetas del feed, mapa y guardados). */
export function fotoDePoi(nombre: string, categoria: string): FotoPoi {
  return fotosDePoi(nombre, categoria)[0];
}

/** Miniatura embebida (data URI) de la portada, para el mapa Leaflet. */
export function miniaturaDePoi(
  nombre: string,
  categoria: string,
): string | undefined {
  return MINIATURAS[fotoDePoi(nombre, categoria).clave];
}
