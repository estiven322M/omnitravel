import { coincideBusqueda, sugerenciasDeBusqueda } from '../utils/busqueda';

const lugar = (nombre: string, categoria = 'Museo', direccion = '') => ({
  nombre,
  categoria,
  direccion,
});

const pois = [
  lugar('Museo del Oro Quindío', 'Museo', 'Cra. 14 # 20-10, Armenia'),
  lugar('Parque Fundadores', 'Parque', 'Cra. 14 # 19-00, Armenia'),
  lugar('Restaurante La Fonda Paisa', 'Restaurante'),
  lugar('Museo Quimbaya', 'Museo'),
];

describe('búsqueda de lugares', () => {
  it('coincide sin tildes ni mayúsculas', () => {
    expect(coincideBusqueda(pois[0], 'QUINDIO')).toBe(true);
  });

  it('acepta palabras en cualquier orden y parciales', () => {
    expect(coincideBusqueda(pois[0], 'oro muse')).toBe(true);
    expect(coincideBusqueda(pois[2], 'paisa fon')).toBe(true);
    expect(coincideBusqueda(pois[1], 'parque oro')).toBe(false);
  });

  it('sugiere desde la primera letra, con el nombre que empieza primero', () => {
    const nombres = sugerenciasDeBusqueda(pois, 'mu').map((p) => p.nombre);
    expect(nombres).toEqual(['Museo del Oro Quindío', 'Museo Quimbaya']);
    expect(sugerenciasDeBusqueda(pois, 'p')[0].nombre).toBe(
      'Parque Fundadores',
    );
  });

  it('no sugiere nada con el campo vacío', () => {
    expect(sugerenciasDeBusqueda(pois, '   ')).toEqual([]);
  });
});
