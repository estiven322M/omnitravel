import type { Poi } from '../types';

/**
 * Datos simulados de POIs del Quindío (Armenia).
 *
 * Mientras el backend expone `MapController` (bounding box → GeoJSON) y los
 * endpoints de POIs, el mapa y el detalle consumen estos mocks tipados con la
 * misma forma que tendrá la respuesta real. Los lugares y coordenadas están
 * inspirados en los mockups oficiales (docs/4. OmniTravel UI_ Mockups.pdf).
 */
export const POIS_MOCK: Poi[] = [
  {
    id: 'poi-museo-quindio',
    nombre: 'Museo del Quindío',
    categoria: 'Museo',
    descripcion:
      'Museo arqueológico y cultural con exposiciones sobre la historia del Quindío.',
    direccion: 'Calle 21 # 14-32',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5346,
    longitud: -75.6786,
    calificacion: 4.6,
    totalExperiencias: 42,
    confirmaciones: 5,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-08-12T10:00:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 120 },
      { caracteristicaId: 'tiene_rampa', valorBooleano: true },
      { caracteristicaId: 'tiene_ascensor', valorBooleano: true },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: false },
      { caracteristicaId: 'tiene_bano_accesible', valorBooleano: true },
      { caracteristicaId: 'tiene_braille', valorBooleano: true },
      { caracteristicaId: 'tiene_piso_podotactil', valorBooleano: false },
    ],
    experiencias: [
      {
        autor: 'Laura M.',
        perfil: 'Experiencia positiva',
        calificacion: 5,
        comentario:
          'Excelente acceso, la rampa es cómoda y el baño adaptado está en muy buen estado.',
      },
      {
        autor: 'Carlos R.',
        perfil: 'Discapacidad visual',
        calificacion: 4,
        comentario:
          'El personal fue amable y la guía en braille fácil de recorrer.',
      },
    ],
  },
  {
    id: 'poi-parque-vida',
    nombre: 'Parque de la Vida',
    categoria: 'Parque',
    descripcion:
      'Parque urbano con senderos, zonas verdes y espacios para toda la familia.',
    direccion: 'Carrera 14 # 21-32',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5423,
    longitud: -75.6629,
    calificacion: 4.7,
    totalExperiencias: 65,
    confirmaciones: 4,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-09-02T09:30:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 150 },
      { caracteristicaId: 'tiene_rampa', valorBooleano: true },
      { caracteristicaId: 'tiene_ascensor', valorBooleano: false },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: false },
      { caracteristicaId: 'tiene_bano_accesible', valorBooleano: true },
      { caracteristicaId: 'tiene_semaforo_sonoro', valorBooleano: true },
      { caracteristicaId: 'tiene_piso_podotactil', valorBooleano: true },
    ],
    experiencias: [
      {
        autor: 'Andrés P.',
        perfil: 'Movilidad reducida',
        calificacion: 5,
        comentario:
          'Los senderos están bien señalizados y el piso podotáctil ayuda muchísimo.',
      },
    ],
  },
  {
    id: 'poi-cafe-parque',
    nombre: 'Café del Parque',
    categoria: 'Restaurante',
    descripcion: 'Café de especialidad con terraza frente al parque.',
    direccion: 'Calle 21 # 14-32',
    ciudad: 'Armenia, Quindío',
    latitud: 4.535,
    longitud: -75.6818,
    calificacion: 4.5,
    totalExperiencias: 38,
    confirmaciones: 3,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-07-28T15:00:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 90 },
      { caracteristicaId: 'tiene_rampa', valorBooleano: true },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: true },
      { caracteristicaId: 'tiene_bano_accesible', valorBooleano: true },
      { caracteristicaId: 'tiene_braille', valorBooleano: true },
    ],
    experiencias: [
      {
        autor: 'Marcela T.',
        perfil: 'Experiencia positiva',
        calificacion: 4,
        comentario: 'Buena atención y menú en braille disponible.',
      },
    ],
  },
  {
    id: 'poi-hotel-mocawa',
    nombre: 'Hotel Mocawa',
    categoria: 'Hotel',
    descripcion: 'Hotel de descanso con instalaciones adaptadas.',
    direccion: 'Kilómetro 1, vía aeropuerto',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5366,
    longitud: -75.6749,
    calificacion: 4.8,
    totalExperiencias: 120,
    confirmaciones: 8,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-09-15T11:00:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 110 },
      { caracteristicaId: 'tiene_rampa', valorBooleano: true },
      { caracteristicaId: 'tiene_ascensor', valorBooleano: true },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: false },
      { caracteristicaId: 'tiene_bano_accesible', valorBooleano: true },
    ],
    experiencias: [
      {
        autor: 'Jorge L.',
        perfil: 'Usuario de silla de ruedas',
        calificacion: 5,
        comentario: 'Habitaciones amplias y ascensor de buen tamaño.',
      },
    ],
  },
  {
    id: 'poi-sabores-parque',
    nombre: 'Sabores del Parque',
    categoria: 'Restaurante',
    descripcion: 'Cocina local e internacional en el corazón de Armenia.',
    direccion: 'Calle 21 # 14-32',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5357,
    longitud: -75.6802,
    calificacion: 4.8,
    totalExperiencias: 56,
    confirmaciones: 3,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-08-12T12:00:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 90 },
      { caracteristicaId: 'tiene_rampa', valorBooleano: true },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: false },
      { caracteristicaId: 'tiene_bano_accesible', valorBooleano: true },
    ],
    experiencias: [
      {
        autor: 'Laura M.',
        perfil: 'Experiencia positiva',
        calificacion: 5,
        comentario:
          'Excelente acceso, la rampa es cómoda y el baño adaptado está en muy buen estado.',
      },
      {
        autor: 'Carlos R.',
        perfil: 'Discapacidad visual',
        calificacion: 5,
        comentario:
          'El personal fue amable y la guía en braille fácil de recorrer.',
      },
    ],
  },
  {
    id: 'poi-centro-cultural',
    nombre: 'Centro Cultural de Armenia',
    categoria: 'Centro cultural',
    descripcion: 'Espacio para artes escénicas, talleres y exposiciones.',
    direccion: 'Carrera 13 # 20-15',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5333,
    longitud: -75.6798,
    calificacion: 4.4,
    totalExperiencias: 25,
    confirmaciones: 2,
    estadoVerificacion: 'EN_REVISION',
    ultimaVerificacion: '2026-09-20T16:00:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 85 },
      { caracteristicaId: 'tiene_rampa', valorBooleano: true },
      { caracteristicaId: 'tiene_ascensor', valorBooleano: true },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: false },
      { caracteristicaId: 'tiene_semaforo_sonoro', valorBooleano: true },
      { caracteristicaId: 'tiene_piso_podotactil', valorBooleano: true },
    ],
    experiencias: [],
  },
  {
    id: 'poi-biblioteca',
    nombre: 'Biblioteca Departamental',
    categoria: 'Biblioteca',
    descripcion:
      'Biblioteca pública con salas de lectura y colecciones regionales.',
    direccion: 'Carrera 14 # 22-36',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5394,
    longitud: -75.6757,
    calificacion: 4.3,
    totalExperiencias: 18,
    confirmaciones: 1,
    estadoVerificacion: 'PENDIENTE',
    ultimaVerificacion: '2026-09-28T10:30:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 95 },
      { caracteristicaId: 'tiene_ascensor', valorBooleano: true },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: true },
      { caracteristicaId: 'tiene_bano_accesible', valorBooleano: true },
      { caracteristicaId: 'tiene_braille', valorBooleano: true },
      { caracteristicaId: 'tiene_piso_podotactil', valorBooleano: true },
    ],
    experiencias: [],
  },
  {
    id: 'poi-terminal',
    nombre: 'Terminal de Transportes',
    categoria: 'Transporte',
    descripcion: 'Terminal intermunicipal de Armenia.',
    direccion: 'Carrera 15 # 35-10',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5396,
    longitud: -75.6651,
    calificacion: 4.0,
    totalExperiencias: 30,
    confirmaciones: 2,
    estadoVerificacion: 'EN_REVISION',
    ultimaVerificacion: '2026-09-10T08:00:00.000Z',
    valores: [
      { caracteristicaId: 'ancho_puerta', valorNumerico: 70 },
      { caracteristicaId: 'tiene_escaleras', valorBooleano: true },
      { caracteristicaId: 'tiene_semaforo_sonoro', valorBooleano: true },
      { caracteristicaId: 'tiene_piso_podotactil', valorBooleano: true },
    ],
    experiencias: [],
  },
];

export function getPoiPorId(id: string): Poi | undefined {
  return POIS_MOCK.find((poi) => poi.id === id);
}
