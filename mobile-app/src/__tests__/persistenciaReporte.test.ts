import { apiFetch } from '../services/api/client';
import { cargarDatosMapa } from '../services/pois';
import { crearReporte, ReporteError } from '../services/reportes';

jest.mock('../services/api/client', () => ({
  API_URL: 'http://192.168.1.10:3000',
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.Mock;

const base = {
  descripcion: 'Rampa en buen estado',
  esCritico: false,
  caracteristicas: [],
};

beforeEach(() => apiFetchMock.mockReset());

describe('crearReporte sobre un lugar existente', () => {
  it('envía el id numérico del lugar (no lo convierte en lugar nuevo)', async () => {
    apiFetchMock.mockResolvedValue({ id_reporte: 9, id_poi: 4 });
    await crearReporte({ ...base, poiId: '4' });
    const cuerpo = JSON.parse(apiFetchMock.mock.calls[0][1].body);
    expect(cuerpo.poiId).toBe(4);
  });

  it('rechaza ids que no son de la BD sin llamar al backend', async () => {
    await expect(
      crearReporte({ ...base, poiId: 'poi-cafe-del-parque' }),
    ).rejects.toBeInstanceOf(ReporteError);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('un lugar nuevo viaja con poiId null', async () => {
    apiFetchMock.mockResolvedValue({ id_reporte: 10, id_poi: 11 });
    await crearReporte({
      ...base,
      poiId: null,
      nombre: 'Café',
      lat: 4.5,
      lon: -75.6,
    });
    const cuerpo = JSON.parse(apiFetchMock.mock.calls[0][1].body);
    expect(cuerpo.poiId).toBeNull();
  });
});

describe('cargarDatosMapa sin backend', () => {
  it('no inventa lugares de demostración', async () => {
    apiFetchMock.mockRejectedValue(
      new Error('No fue posible comunicarse con el servidor.'),
    );
    const datos = await cargarDatosMapa();
    expect(datos.fuente).toBe('sin-conexion');
    expect(datos.pois).toEqual([]);
    expect(datos.advertencia).toContain('http://192.168.1.10:3000');
  });
});
