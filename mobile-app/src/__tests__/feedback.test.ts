import { apiFetch } from '../services/api/client';
import {
  crearExperiencia,
  experienciasDePoi,
  finalizarVisita,
  iniciarVisita,
  visitasPendientes,
} from '../services/api/feedback';

/** Proceso 3 — visitas y retroalimentación post-viaje (U07, U13, Inicio). */
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

describe('servicio de visitas y experiencias', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('inicia la visita con el id numérico del lugar (POST /visitas)', async () => {
    apiFetchMock.mockResolvedValueOnce({ visita: { id_visita: 9 } });
    await iniciarVisita('17');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/visitas',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ poi_id: 17 }),
      }),
    );
  });

  it('finaliza la visita (POST /visitas/:id/finalizar)', async () => {
    apiFetchMock.mockResolvedValueOnce({ visita: { estado: 'completada' } });
    await finalizarVisita(9);
    expect(apiFetchMock).toHaveBeenCalledWith('/visitas/9/finalizar', {
      method: 'POST',
    });
  });

  it('consulta las visitas pendientes de calificar', async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await expect(visitasPendientes()).resolves.toEqual([]);
    expect(apiFetchMock).toHaveBeenCalledWith('/visitas/pendientes');
  });

  it('envía la experiencia con la discrepancia (POST /experiences)', async () => {
    apiFetchMock.mockResolvedValueOnce({ incidencia: { id_incidencia: 3 } });
    await crearExperiencia({
      visita_id: 9,
      calificacion: 2,
      discrepancia: true,
      tipo_incidencia: 'barrera',
      descripcion_incidencia: 'Rampa bloqueada',
    });
    const [ruta, opciones] = apiFetchMock.mock.calls[0];
    expect(ruta).toBe('/experiences');
    expect(JSON.parse(String(opciones?.body))).toMatchObject({
      visita_id: 9,
      discrepancia: true,
    });
  });

  it('muestra el mensaje del backend sin el código técnico', async () => {
    const { ApiError } = jest.requireMock('../services/api/client');
    apiFetchMock.mockRejectedValueOnce(
      new ApiError('VISITA_YA_CALIFICADA: Ya calificaste esta visita.', 409),
    );
    await expect(experienciasDePoi(17)).rejects.toThrow(
      'Ya calificaste esta visita.',
    );
  });
});
