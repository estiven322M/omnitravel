import { motivoDeRechazo } from '../screens/moderacion/RevisionReporteScreen';
import {
  listarIncidencias,
  obtenerResumenModeracion,
} from '../services/moderacion';
import {
  dimensionDeReporte,
  haceCuanto,
  tipoDeReporte,
} from '../utils/moderacion';

const mockApiFetch = jest.fn();
jest.mock('../services/api/client', () => {
  const real = jest.requireActual('../services/api/client');
  return { ...real, apiFetch: (...args: unknown[]) => mockApiFetch(...args) };
});
jest.mock('expo-secure-store', () => ({}));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-file-system', () => ({}));

beforeEach(() => mockApiFetch.mockReset());

describe('clasificación de reportes (M03)', () => {
  it('detecta la dimensión por las características propuestas', () => {
    expect(dimensionDeReporte([{ nombre: 'Tiene rampa' }])).toBe('Motriz');
    expect(dimensionDeReporte([{ nombre: 'Tiene semáforo sonoro' }])).toBe(
      'Sensorial',
    );
    expect(dimensionDeReporte([{ nombre: 'Tiene piso podotáctil' }])).toBe(
      'Sensorial',
    );
    expect(dimensionDeReporte([])).toBe('Otra');
  });

  it('las barreras críticas se muestran como «Barrera / Obstáculo»', () => {
    expect(tipoDeReporte(true).texto).toBe('Barrera / Obstáculo');
    expect(tipoDeReporte(false).texto).toBe('Lugar Accesible');
  });

  it('haceCuanto da textos relativos', () => {
    const ahora = Date.UTC(2026, 9, 19, 12);
    expect(
      haceCuanto(new Date(ahora - 2 * 3600_000).toISOString(), ahora),
    ).toBe('Hace 2 horas');
    expect(
      haceCuanto(new Date(ahora - 26 * 3600_000).toISOString(), ahora),
    ).toBe('Ayer');
  });
});

describe('motivo de rechazo (M05)', () => {
  it('combina el motivo elegido con el detalle opcional', () => {
    expect(motivoDeRechazo('duplicado', '')).toBe('Duplicado');
    expect(motivoDeRechazo('gps', ' Está en otra calle ')).toBe(
      'Ubicación GPS incorrecta. Está en otra calle',
    );
  });
});

describe('servicio del panel de moderación', () => {
  it('mapea el resumen del backend', async () => {
    mockApiFetch.mockResolvedValue({
      pendientes: 2,
      discrepancias: 1,
      verificadosHoy: 0,
      alertasCriticas: [
        {
          id_reporte: 4,
          tipo: null,
          fecha_creacion: '2026-10-19T00:00:00Z',
          poi_nombre: 'Parque',
          direccion: null,
          confirmaciones: 1,
          evidencia: null,
        },
      ],
      actividadReciente: [],
      desempeno: {
        tasaResolucion: 50,
        procesadosMes: 1,
        procesadosMesAnterior: 0,
        horasPromedio: null,
      },
    });
    const resumen = await obtenerResumenModeracion();
    expect(mockApiFetch.mock.calls[0][0]).toBe('/moderacion/resumen');
    expect(resumen.alertasCriticas[0]).toEqual({
      idReporte: '4',
      tipo: 'reporte',
      fechaCreacion: '2026-10-19T00:00:00Z',
      poiNombre: 'Parque',
      direccion: '',
      confirmaciones: 1,
      evidencia: null,
    });
  });

  it('mapea las incidencias con su gravedad', async () => {
    mockApiFetch.mockResolvedValue([
      {
        id_incidencia: 1,
        tipo: 'discrepancia',
        descripcion: 'x',
        estado: 'abierta',
        fecha_creacion: '2026-10-19T00:00:00Z',
        comentario: 'Rampa bloqueada',
        calificacion: 1,
        autor: null,
        gravedad: 'alta',
        poi_id: 2,
        poi_nombre: 'Parque',
        poi_direccion: null,
        poi_tipo: 'parque',
        poi_estado: 'publicado',
      },
    ]);
    const [incidencia] = await listarIncidencias();
    expect(incidencia).toMatchObject({
      id: '1',
      gravedad: 'alta',
      poi: { id: '2', tipo: 'parque' },
    });
  });
});
