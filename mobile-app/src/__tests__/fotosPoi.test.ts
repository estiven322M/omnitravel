import { fotoDePoi, fotosDePoi } from '../services/mocks/fotosPoi';

describe('fotos de los lugares', () => {
  it('usa la foto propia del lugar del mockup (sin acentos ni mayúsculas)', () => {
    const cafe = fotoDePoi('Café del Parque', 'Restaurante');
    expect(cafe.referencia).toBe(false);
    expect(fotoDePoi('cafe del parque', 'Restaurante').fuente).toBe(
      cafe.fuente,
    );
    expect(fotoDePoi('Museo del Quindío', 'Museo').referencia).toBe(false);
  });

  it('todo lugar sin foto propia recibe la de su categoría', () => {
    for (const categoria of [
      'Restaurante',
      'Hotel',
      'Museo',
      'Parque',
      'atraccion',
    ]) {
      const foto = fotoDePoi('Lugar sin foto', categoria);
      expect(foto.fuente).toBeDefined();
      expect(foto.referencia).toBe(true);
    }
    expect(fotoDePoi('Parque Fundadores', 'Parque').fuente).not.toBe(
      fotoDePoi('Hotel Boutique Plaza', 'Hotel').fuente,
    );
  });

  it('una categoría desconocida también tiene foto (nunca vacío)', () => {
    expect(fotosDePoi('Biblioteca Departamental', 'Biblioteca')).toHaveLength(
      1,
    );
    expect(fotosDePoi('', '')[0].fuente).toBeDefined();
  });

  it('los restaurantes traen la galería del mockup U08', () => {
    expect(
      fotosDePoi('Restaurante La Fonda Paisa', 'Restaurante').map(
        (f) => f.leyenda,
      ),
    ).toEqual(['Acceso', 'Interior', 'Baño adaptado', 'Zona de mesas']);
  });
});
