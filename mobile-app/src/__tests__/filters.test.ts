import type { Poi } from '../services/types';
import { aplicarFiltros, type FiltroId } from '../utils/filters';

function crearPoi(id: string, valores: Poi['valores']): Poi {
  return {
    id,
    nombre: `POI ${id}`,
    categoria: 'Museo',
    descripcion: '',
    direccion: '',
    ciudad: 'Armenia, Quindío',
    latitud: 4.5,
    longitud: -75.6,
    calificacion: 4,
    totalExperiencias: 0,
    confirmaciones: 3,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-01-01T00:00:00.000Z',
    valores,
    experiencias: [],
  };
}

describe('aplicarFiltros', () => {
  const accesible = crearPoi('a', [
    { caracteristicaId: 'ancho_puerta', valorNumerico: 90 },
    { caracteristicaId: 'tiene_escaleras', valorBooleano: false },
    { caracteristicaId: 'tiene_ascensor', valorBooleano: true },
    { caracteristicaId: 'tiene_semaforo_sonoro', valorBooleano: true },
  ]);

  const conBarreras = crearPoi('b', [
    { caracteristicaId: 'ancho_puerta', valorNumerico: 70 },
    { caracteristicaId: 'tiene_escaleras', valorBooleano: true },
    { caracteristicaId: 'tiene_ascensor', valorBooleano: false },
  ]);

  const sinDatos = crearPoi('c', []);

  it('sin filtros devuelve todos los POIs', () => {
    const resultado = aplicarFiltros([accesible, conBarreras, sinDatos], []);
    expect(resultado).toHaveLength(3);
  });

  it('filtra por ancho de puerta mínimo y excluye POIs sin el dato', () => {
    const resultado = aplicarFiltros(
      [accesible, conBarreras, sinDatos],
      ['ancho_puerta_80'],
    );
    expect(resultado.map((poi) => poi.id)).toEqual(['a']);
  });

  it('"sin escalones" exige el valor booleano false explícito', () => {
    const resultado = aplicarFiltros(
      [accesible, conBarreras, sinDatos],
      ['sin_escalones'],
    );
    expect(resultado.map((poi) => poi.id)).toEqual(['a']);
  });

  it('combina filtros con lógica AND', () => {
    const resultado = aplicarFiltros([accesible, conBarreras], [
      'ascensor_amplio',
      'semaforos_sonoros',
    ] as FiltroId[]);
    expect(resultado.map((poi) => poi.id)).toEqual(['a']);
  });

  it('un filtro sensorial sin coincidencias devuelve lista vacía', () => {
    const resultado = aplicarFiltros(
      [accesible, conBarreras, sinDatos],
      ['menu_braille'],
    );
    expect(resultado).toHaveLength(0);
  });
});
