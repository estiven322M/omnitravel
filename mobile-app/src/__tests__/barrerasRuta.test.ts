import type { Poi, ReporteResumen } from '../services/types';
import {
  barreraCercana,
  barrerasEnRuta,
  textoBarreraCercana,
  ubicarBarreras,
} from '../utils/barrerasRuta';

function poi(id: string, latitud: number, longitud: number): Poi {
  return {
    id,
    nombre: `Lugar ${id}`,
    categoria: 'Parque',
    descripcion: '',
    direccion: '',
    ciudad: 'Armenia, Quindío',
    latitud,
    longitud,
    calificacion: 0,
    totalExperiencias: 0,
    confirmaciones: 0,
    estadoVerificacion: 'VERIFICADO',
    ultimaVerificacion: '2026-11-01T00:00:00.000Z',
    valores: [],
    experiencias: [],
  };
}

function barrera(id: string, poiId: string, esCritico = true): ReporteResumen {
  return {
    id,
    poiId,
    tipo: 'barrera',
    estado: 'pendiente_validacion',
    descripcion: 'Andén roto',
    esCritico,
    fechaCreacion: '2026-11-01T00:00:00.000Z',
    confirmaciones: 0,
  };
}

const LUGARES: Record<string, Poi> = {
  a: poi('a', 4.535, -75.675), // sobre la ruta
  b: poi('b', 4.545, -75.66), // lejos de la ruta
  d: poi('d', 4.536, -75.67), // destino
};
const porId = (id: string) => LUGARES[id];
// Ruta recta este-oeste sobre la latitud 4.535.
const RUTA = [
  { latitude: 4.535, longitude: -75.68 },
  { latitude: 4.535, longitude: -75.67 },
];

describe('barreras críticas en la navegación (RT1/RT3, S02)', () => {
  const ubicadas = ubicarBarreras(
    [
      barrera('1', 'a'),
      barrera('2', 'b'),
      barrera('3', 'd'),
      barrera('4', 'a', false),
    ],
    porId,
    'd',
  );

  it('ubica solo las barreras críticas, sin el destino ni repetidas', () => {
    expect(ubicadas.map((b) => b.id)).toEqual(['1', '2']);
  });

  it('detecta las barreras por las que pasa la ruta', () => {
    expect(barrerasEnRuta(RUTA, ubicadas).map((b) => b.id)).toEqual(['1']);
  });

  it('alerta solo a menos de 60 m de la posición real', () => {
    const cerca = barreraCercana(
      { latitude: 4.5353, longitude: -75.675 },
      ubicadas,
    );
    expect(cerca?.barrera.id).toBe('1');
    expect(cerca!.metros).toBeLessThan(60);
    expect(
      barreraCercana({ latitude: 4.54, longitude: -75.675 }, ubicadas),
    ).toBeNull();
  });

  it('el texto de alerta es estable para no repetir el aviso', () => {
    expect(textoBarreraCercana(ubicadas[0])).toBe(
      textoBarreraCercana(ubicadas[0]),
    );
    expect(textoBarreraCercana(ubicadas[0])).toContain('Andén roto');
  });
});
