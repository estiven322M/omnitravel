/**
 * Lugares reales de Armenia (Quindío) para OmniTravel.
 *
 * - `consulta`: búsqueda en OpenStreetMap (Nominatim) para las coordenadas.
 * - `respaldo`: coordenadas aproximadas si OSM no encuentra el lugar.
 * - `reutilizarId`: POI que ya existe en la BD y se corrige (no se duplica).
 * - `fotos`: archivos de Wikimedia Commons verificados (licencia libre).
 *   Si no hay suficientes, el script busca fotos geolocalizadas cerca.
 * - `valores`: valores iniciales de accesibilidad. Son datos de partida que
 *   la comunidad confirma o corrige con el Proceso 1 (validación colaborativa).
 *
 * Características (tabla caracteristica_accesibilidad):
 *   1 rampa · 2 ascensor · 3 baño adaptado · 4 menú Braille ·
 *   5 piso podotáctil · 6 semáforo sonoro · 7 ancho de puerta (cm)
 */

const espacioPublico = { 1: true, 2: false, 3: false, 4: false, 5: true, 6: true, 7: 200 };
const edificioCultural = { 1: true, 2: true, 3: true, 4: false, 5: true, 6: false, 7: 110 };
const templo = { 1: true, 2: false, 3: false, 4: false, 5: false, 6: true, 7: 180 };
const centroComercial = { 1: true, 2: true, 3: true, 4: false, 5: true, 6: true, 7: 150 };

export const LUGARES = [
  {
    nombre: 'Museo del Oro Quimbaya',
    tipo: 'museo',
    direccion: 'Avenida Bolívar #40 Norte-80, Armenia',
    descripcion:
      'Centro cultural del Banco de la República con orfebrería y cerámica de la cultura quimbaya. Entrada gratuita.',
    consulta: 'Museo del Oro Quimbaya, Armenia, Quindío',
    respaldo: [4.5534, -75.6586],
    reutilizarId: 17,
    fotos: [
      { archivo: 'Museo_del_Oro_Quimbaya.jpg', leyenda: 'Fachada' },
      { archivo: 'Museo_Quimbaya_Armenia_Quindio.JPG', leyenda: 'Edificio del museo' },
    ],
    valores: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 7: 120 },
  },
  {
    nombre: 'Plaza de Bolívar de Armenia',
    tipo: 'atraccion',
    direccion: 'Entre carreras 12 y 13, calles 20 y 21, Armenia',
    descripcion:
      'Plaza principal de la ciudad, frente a la Catedral y la Gobernación del Quindío, con el monumento al Esfuerzo.',
    consulta: 'Plaza de Bolívar, Armenia, Quindío',
    respaldo: [4.5338, -75.6727],
    fotos: [
      {
        archivo: 'Armenia,_Quindio,_Colombia_-_panoramio_-_Jimmy_Gómez_N_(15).jpg',
        leyenda: 'Plaza de Bolívar',
      },
    ],
    valores: espacioPublico,
  },
  {
    nombre: 'Catedral de la Inmaculada Concepción',
    tipo: 'atraccion',
    direccion: 'Carrera 13 con calle 21, Plaza de Bolívar, Armenia',
    descripcion: 'Catedral de Armenia, de arquitectura moderna, frente a la Plaza de Bolívar.',
    consulta: 'Catedral de la Inmaculada Concepción, Armenia, Quindío',
    respaldo: [4.5342, -75.6733],
    fotos: [
      { archivo: 'Catedral_de_armenia.jpg', leyenda: 'Fachada de la catedral' },
      { archivo: 'Día_cálido.jpg', leyenda: 'Vista en día soleado' },
    ],
    valores: templo,
  },
  {
    nombre: 'Gobernación del Quindío',
    tipo: 'atraccion',
    direccion: 'Calle 20 #13-22, Armenia',
    descripcion:
      'Centro Administrativo Departamental, edificio emblemático junto a la Plaza de Bolívar.',
    consulta: 'Gobernación del Quindío, Armenia',
    respaldo: [4.5331, -75.6722],
    fotos: [
      {
        archivo: 'Armenia,_Quindio,_Colombia_-_panoramio_-_Jimmy_Gómez_N_(5).jpg',
        leyenda: 'Edificio de la Gobernación',
      },
    ],
    valores: { 1: true, 2: true, 3: true, 4: false, 5: false, 6: true, 7: 120 },
  },
  {
    nombre: 'Estación del Ferrocarril de Armenia',
    tipo: 'atraccion',
    direccion: 'Carreras 18 y 19 con calle 26, Armenia',
    descripcion:
      'Antigua estación del Ferrocarril de Caldas, monumento nacional y hoy espacio cultural.',
    consulta: 'Estación del Ferrocarril, Armenia, Quindío',
    respaldo: [4.5401, -75.6698],
    fotos: [
      { archivo: 'Estacion_ferrocarril_Armenia_Quindio.JPG', leyenda: 'Fachada principal' },
      { archivo: 'Estacion_ferrocarril_Armenia_Quindio_2.JPG', leyenda: 'Vista lateral' },
    ],
    valores: { 1: true, 2: false, 3: true, 4: false, 5: false, 6: false, 7: 150 },
  },
  {
    nombre: 'Edificio de Bellas Artes (Pasaje Yanuba)',
    tipo: 'atraccion',
    direccion: 'Calle 21 con carrera 15, Armenia',
    descripcion: 'Edificio patrimonial de Bellas Artes y el pasaje peatonal Yanuba, en el centro.',
    consulta: 'Bellas Artes, Armenia, Quindío',
    respaldo: [4.5359, -75.6714],
    fotos: [
      { archivo: 'Bellas_Artes_de_Armenia,_Pasaje_Yanuba.jpg', leyenda: 'Edificio de Bellas Artes' },
    ],
    valores: edificioCultural,
  },
  {
    nombre: 'Centro Comercial Cielos Abiertos',
    tipo: 'atraccion',
    direccion: 'Carrera 14 (peatonal), centro de Armenia',
    descripcion:
      'Calle comercial peatonal cubierta de la carrera 14, con comercio y servicios del centro.',
    consulta: 'Cielos Abiertos, Armenia, Quindío',
    respaldo: [4.5365, -75.6718],
    fotos: [{ archivo: 'Cc_cielo_abierto.jpg', leyenda: 'Carrera 14 peatonal' }],
    valores: { 1: true, 2: false, 3: false, 4: false, 5: true, 6: true, 7: 300 },
  },
  {
    nombre: 'Centro Comercial Unicentro Armenia',
    tipo: 'atraccion',
    direccion: 'Avenida Bolívar, norte de Armenia',
    descripcion: 'Centro comercial sobre la Avenida Bolívar con almacenes, cine y plazoleta de comidas.',
    consulta: 'Unicentro, Armenia, Quindío',
    respaldo: [4.5487, -75.6625],
    fotos: [{ archivo: 'Día_frío.jpg', leyenda: 'Avenida Bolívar frente a Unicentro' }],
    valores: centroComercial,
  },
  {
    nombre: 'Estadio Centenario',
    tipo: 'atraccion',
    direccion: 'Avenida Centenario, sur de Armenia',
    descripcion: 'Estadio del Deportes Quindío, con capacidad para unas 20.000 personas.',
    consulta: 'Estadio Centenario, Armenia, Quindío',
    respaldo: [4.5153, -75.6984],
    fotos: [{ archivo: 'Estadio_Centenario_Tribuna_Oriental.jpg', leyenda: 'Tribuna oriental' }],
    valores: { 1: true, 2: false, 3: true, 4: false, 5: false, 6: false, 7: 120 },
  },
  {
    nombre: 'Parroquia San Francisco de Asís',
    tipo: 'atraccion',
    direccion: 'Centro Administrativo Municipal (CAM), Armenia',
    descripcion: 'Iglesia junto al Centro Administrativo Municipal de Armenia.',
    consulta: 'Iglesia San Francisco de Asís, Armenia, Quindío',
    respaldo: [4.5404, -75.6676],
    fotos: [{ archivo: 'SAN-FRANCISCO-DE-ASIS-ARMENIA.jpg', leyenda: 'Fachada' }],
    valores: templo,
  },
  {
    nombre: 'Parque Fundadores',
    tipo: 'parque',
    direccion: 'Avenida Bolívar, Armenia',
    descripcion:
      'Parque que rinde homenaje a los fundadores de la ciudad, junto a la Parroquia del Espíritu Santo.',
    consulta: 'Parque Fundadores, Armenia, Quindío',
    respaldo: [4.5445, -75.6648],
    reutilizarId: 2,
    fotos: [{ archivo: 'Parroquia-Espíritu-Santo-(3).jpg', leyenda: 'Parroquia del Espíritu Santo' }],
    valores: espacioPublico,
  },
  {
    nombre: 'Parque de la Vida',
    tipo: 'parque',
    direccion: 'Avenida Bolívar con calle 7 Norte, Armenia',
    descripcion:
      'Parque urbano con lagos, cascadas, puentes y senderos entre guaduales; punto de encuentro de recorridos.',
    consulta: 'Parque de la Vida, Armenia, Quindío',
    respaldo: [4.5466, -75.6658],
    fotos: [],
    valores: { 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: 150 },
  },
  {
    nombre: 'Parque Sucre',
    tipo: 'parque',
    direccion: 'Centro de Armenia',
    descripcion: 'Parque tradicional del centro de Armenia.',
    consulta: 'Parque Sucre, Armenia, Quindío',
    respaldo: [4.5383, -75.6694],
    reutilizarId: 22,
    fotos: [],
    valores: espacioPublico,
  },
  {
    nombre: 'Universidad del Quindío',
    tipo: 'atraccion',
    direccion: 'Carrera 15 Calle 12 Norte, Armenia',
    descripcion: 'Universidad pública del departamento, con campus abierto y zonas verdes.',
    consulta: 'Universidad del Quindío, Armenia',
    respaldo: [4.555, -75.6597],
    fotos: [],
    valores: { 1: true, 2: true, 3: true, 4: false, 5: true, 6: true, 7: 120 },
  },
  {
    nombre: 'Centro Cultural Metropolitano de Convenciones',
    tipo: 'atraccion',
    direccion: 'Armenia, Quindío',
    descripcion: 'Centro de convenciones y eventos culturales de la ciudad.',
    consulta: 'Centro Cultural Metropolitano de Convenciones, Armenia',
    respaldo: [4.5408, -75.6685],
    reutilizarId: 21,
    fotos: [],
    valores: edificioCultural,
  },
  {
    nombre: 'Terminal de Transportes de Armenia',
    tipo: 'atraccion',
    direccion: 'Calle 35 #20-68, Armenia',
    descripcion: 'Terminal de buses intermunicipales hacia Salento, Filandia y el resto del país.',
    consulta: 'Terminal de Transportes, Armenia, Quindío',
    respaldo: [4.5233, -75.6826],
    fotos: [],
    valores: { 1: true, 2: false, 3: true, 4: false, 5: true, 6: true, 7: 150 },
  },
];

/**
 * Lugares de prueba, inventados o duplicados que se eliminan (ver
 * `npm run ver-lugares`). Se conservan y corrigen los ids 2, 17, 21 y 22.
 */
export const ELIMINAR_IDS = [
  1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  32,
];
