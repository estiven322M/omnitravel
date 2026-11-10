import * as SecureStore from 'expo-secure-store';
import {
  iniciarSesionCuenta,
  registrarCuenta,
  mensajeLegible,
  rolDeUsuarioId,
} from '../services/api/auth';
import { ApiError } from '../services/api/client';

const mockApiFetch = jest.fn();
jest.mock('../services/api/client', () => {
  const real = jest.requireActual('../services/api/client');
  return {
    ...real,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

beforeEach(() => {
  mockApiFetch.mockReset();
  jest.clearAllMocks();
});

describe('mensajeLegible', () => {
  it('quita el código técnico del backend', () => {
    expect(
      mensajeLegible('INVALID_CREDENTIALS: Correo o contraseña incorrectos.'),
    ).toBe('Correo o contraseña incorrectos.');
  });

  it('deja intactos los mensajes sin código', () => {
    expect(mensajeLegible('No fue posible comunicarse con el servidor.')).toBe(
      'No fue posible comunicarse con el servidor.',
    );
  });
});

describe('iniciarSesionCuenta', () => {
  it('normaliza el correo y guarda el token en el almacenamiento seguro', async () => {
    mockApiFetch.mockResolvedValue({
      token: 'jwt',
      usuario: { id_usuario: 3, email: 'ana@b.co', rol_id: 1, rol: 'viajero' },
    });

    const { perfil } = await iniciarSesionCuenta('  Ana@B.co ', 'Clave#2026');

    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toEqual({
      email: 'ana@b.co',
      password: 'Clave#2026',
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'omnitravel-token',
      'jwt',
    );
    expect(perfil?.rol).toBe('viajero');
  });

  it('muestra el error del backend sin el código interno', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(
        'INVALID_CREDENTIALS: Correo o contraseña incorrectos.',
        401,
      ),
    );

    await expect(iniciarSesionCuenta('a@b.co', 'mala')).rejects.toMatchObject({
      message: 'Correo o contraseña incorrectos.',
      status: 401,
    });
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('el límite de intentos llega con un mensaje claro', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(
        'DEMASIADOS_INTENTOS: Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
        429,
      ),
    );
    await expect(iniciarSesionCuenta('a@b.co', 'x')).rejects.toThrow(
      'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    );
  });
});

describe('rolDeUsuarioId', () => {
  it('traduce el catálogo y usa viajero por defecto', () => {
    expect(rolDeUsuarioId(4)).toBe('moderador');
    expect(rolDeUsuarioId(99)).toBe('viajero');
    expect(rolDeUsuarioId(null)).toBe('viajero');
  });
});

describe('registro con la política de datos (Ley 1581)', () => {
  it('envía la aceptación de la política al crear la cuenta', async () => {
    mockApiFetch.mockResolvedValue({
      token: 't',
      usuario: { id_usuario: 9, email: 'ana@correo.co', rol: 'viajero' },
    });
    await registrarCuenta({
      nombre: 'Ana',
      email: 'Ana@Correo.co',
      contrasena: 'Segura123!',
      aceptaPolitica: true,
    });
    const [ruta, init] = mockApiFetch.mock.calls[0] as [string, RequestInit];
    expect(ruta).toBe('/auth/register');
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: 'ana@correo.co',
      aceptaPolitica: true,
    });
  });
});
