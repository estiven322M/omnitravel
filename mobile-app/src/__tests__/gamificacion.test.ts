import {
  calcularPuntos,
  nivelComunitario,
  progresoNivel,
  textoSiguienteNivel,
} from '../utils/gamificacion';

describe('gamificación del perfil (U3)', () => {
  it('publicar vale más que reportar y las confirmaciones suman', () => {
    expect(
      calcularPuntos({
        reportesCreados: 3,
        publicados: 1,
        barreras: 1,
        confirmacionesRecibidas: 2,
      }),
    ).toBe(100 + 2 * 40 + 2 * 10);
  });

  it('asigna el nivel según los puntos y el umbral del siguiente', () => {
    expect(nivelComunitario(0).nombre).toBe('Explorador Novato');
    expect(nivelComunitario(0).siguiente).toBe(100);
    expect(nivelComunitario(260).nombre).toBe('Pionero Sin Barreras');
    expect(nivelComunitario(900).siguiente).toBeNull();
  });

  it('calcula el avance hacia el siguiente nivel y su texto accesible', () => {
    expect(progresoNivel(50)).toBeCloseTo(0.5);
    expect(progresoNivel(900)).toBe(1);
    expect(textoSiguienteNivel(120)).toBe('Siguiente nivel: 250 puntos');
    expect(textoSiguienteNivel(900)).toBe('Nivel máximo alcanzado');
  });
});
