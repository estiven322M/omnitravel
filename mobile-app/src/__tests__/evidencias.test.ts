import { subirEvidencia, urlPublicaEvidencia } from '../services/evidencias';

const mockApiFetch = jest.fn();
jest.mock('../services/api/client', () => ({
  API_URL: 'http://api.test',
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
jest.mock('expo-image-picker', () => ({}));

const FOTO = {
  uri: 'file:///foto.jpg',
  base64: '/9j/AAAA',
  mimeType: 'image/jpeg',
};

beforeEach(() => mockApiFetch.mockReset());

describe('subirEvidencia', () => {
  it('envía la foto en base64 a POST /evidencias con un timeout amplio', async () => {
    mockApiFetch.mockResolvedValue({ storageKey: '7/1700000000000-abc.jpg' });

    await expect(subirEvidencia(FOTO)).resolves.toEqual({
      storageKey: '7/1700000000000-abc.jpg',
    });

    const [ruta, init, timeout] = mockApiFetch.mock.calls[0];
    expect(ruta).toBe('/evidencias');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      base64: '/9j/AAAA',
      mimeType: 'image/jpeg',
    });
    expect(timeout).toBeGreaterThanOrEqual(30000);
  });

  it('sin sesión pide iniciar sesión', async () => {
    mockApiFetch.mockRejectedValue(
      new Error('USUARIO_NO_VINCULADO: Inicia sesión para continuar.'),
    );
    await expect(subirEvidencia(FOTO)).rejects.toThrow(
      'Necesitas una sesión activa para adjuntar la foto de evidencia.',
    );
  });

  it('cualquier otro fallo se muestra con un mensaje amable', async () => {
    mockApiFetch.mockRejectedValue(
      new Error('FILE_REJECTED: La foto supera los 5 MB.'),
    );
    await expect(subirEvidencia(FOTO)).rejects.toThrow(
      'No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.',
    );
  });
});

describe('urlPublicaEvidencia', () => {
  it('construye la URL de lectura del backend', () => {
    expect(urlPublicaEvidencia('7/1700000000000-abc.jpg')).toBe(
      'http://api.test/evidencias/archivo/7/1700000000000-abc.jpg',
    );
  });

  it('agrega el permiso temporal que firma el backend', () => {
    expect(
      urlPublicaEvidencia(
        '7/1700000000000-abc.jpg',
        'exp=1762621200&firma=x_Y',
      ),
    ).toBe(
      'http://api.test/evidencias/archivo/7/1700000000000-abc.jpg?exp=1762621200&firma=x_Y',
    );
  });
});
