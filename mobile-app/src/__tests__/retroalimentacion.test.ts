import { apiFetch } from '../services/api/client';
import {
  enviarRetroalimentacion,
  mapearErrorRetro,
} from '../services/retroalimentacion';
import {
  abriraIncidencia,
  BORRADOR_RETRO_INICIAL,
  construirCuerpoRetro,
  esBorradorValido,
  validarBorradorRetro,
  type BorradorRetroalimentacion,
} from '../utils/retroalimentacion';

/** Proceso 3 — Retroalimentación post-viaje (U13): lógica del formulario y servicio. */

jest.mock('../services/api/client', () => {
  class ApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return { apiFetch: jest.fn(), ApiError };
});

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

const BUENA: BorradorRetroalimentacion = {
  ...BORRADOR_RETRO_INICIAL,
  calificacion: 5,
  comentario: '  Rampa amplia y baño accesible  ',
  coincide: true,
};

const CON_DISCREPANCIA: BorradorRetroalimentacion = {
  calificacion: 3,
  comentario: '',
  coincide: false,
  tipoDiscrepancia: 'barrera_nueva',
  descripcionDiscrepancia: 'La rampa está bloqueada por obras',
};

describe('validarBorradorRetro', () => {
  it('el formulario vacío pide calificación y respuesta de coincidencia', () => {
    const errores = validarBorradorRetro(BORRADOR_RETRO_INICIAL);
    expect(errores.calificacion).toBeDefined();
    expect(errores.coincide).toBeDefined();
  });

  it('una experiencia completa sin discrepancia es válida', () => {
    expect(esBorradorValido(BUENA)).toBe(true);
  });

  it('con discrepancia exige tipo y descripción de al menos 10 caracteres', () => {
    const errores = validarBorradorRetro({
      ...CON_DISCREPANCIA,
      tipoDiscrepancia: null,
      descripcionDiscrepancia: 'corto',
    });
    expect(errores.tipoDiscrepancia).toBeDefined();
    expect(errores.descripcionDiscrepancia).toBeDefined();
    expect(esBorradorValido(CON_DISCREPANCIA)).toBe(true);
  });

  it('rechaza comentarios de más de 500 caracteres', () => {
    expect(
      validarBorradorRetro({ ...BUENA, comentario: 'x'.repeat(501) })
        .comentario,
    ).toBeDefined();
  });
});

describe('abriraIncidencia', () => {
  it('avisa cuando hay discrepancia o la calificación es 1 o 2', () => {
    expect(abriraIncidencia(CON_DISCREPANCIA)).toBe(true);
    expect(abriraIncidencia({ ...BUENA, calificacion: 2 })).toBe(true);
    expect(abriraIncidencia({ ...BUENA, calificacion: 3 })).toBe(false);
    expect(abriraIncidencia(BORRADOR_RETRO_INICIAL)).toBe(false);
  });
});

describe('construirCuerpoRetro', () => {
  it('sin discrepancia envía solo calificación y comentario recortado', () => {
    expect(construirCuerpoRetro('7', BUENA)).toEqual({
      poiId: 7,
      calificacion: 5,
      comentario: 'Rampa amplia y baño accesible',
      coincide: true,
    });
  });

  it('con discrepancia incluye el tipo y la descripción', () => {
    expect(construirCuerpoRetro('7', CON_DISCREPANCIA)).toMatchObject({
      coincide: false,
      tipoDiscrepancia: 'barrera_nueva',
      descripcionDiscrepancia: 'La rampa está bloqueada por obras',
    });
  });
});

describe('enviarRetroalimentacion', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('hace POST /retroalimentacion y normaliza la respuesta', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id_retroalimentacion: 31,
      id_incidencia: 9,
      escalada: true,
      gravedad: 'media',
    });
    const resultado = await enviarRetroalimentacion(
      construirCuerpoRetro('7', CON_DISCREPANCIA),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/retroalimentacion',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(resultado).toEqual({
      id: '31',
      incidenciaId: '9',
      escalada: true,
      gravedad: 'media',
    });
  });

  it('traduce la retroalimentación duplicada a un mensaje claro', async () => {
    apiFetchMock.mockRejectedValueOnce(
      new Error('RETROALIMENTACION_DUPLICADA: Ya calificaste este lugar.'),
    );
    await expect(
      enviarRetroalimentacion(construirCuerpoRetro('7', BUENA)),
    ).rejects.toMatchObject({ codigo: 'RETROALIMENTACION_DUPLICADA' });
  });
});

describe('mapearErrorRetro', () => {
  it('degrada errores desconocidos (red) a un texto amable', () => {
    const error = mapearErrorRetro(new Error('Network request failed'));
    expect(error.codigo).toBe('DESCONOCIDO');
    expect(error.message).toContain('conexión');
  });
});
