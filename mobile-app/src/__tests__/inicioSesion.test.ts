import {
  iniciarSesionCompleta,
  SinPermisoModeracionError,
  usaPanelModeracion,
} from '../services/inicioSesion';
import { useProfileStore } from '../store/profileStore';

const mockIniciar = jest.fn();
const mockCerrar = jest.fn();
jest.mock('../services/api/auth', () => {
  const real = jest.requireActual('../services/api/auth');
  return {
    ...real,
    iniciarSesionCuenta: (...args: unknown[]) => mockIniciar(...args),
    cerrarSesionCuenta: (...args: unknown[]) => mockCerrar(...args),
  };
});
jest.mock('../services/fotoPerfil', () => ({
  uriFotoDePerfilGuardada: () => null,
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  mockIniciar.mockReset();
  mockCerrar.mockReset();
  useProfileStore.setState({ perfil: null });
});

describe('inicio de sesión (U02 / M01)', () => {
  it('guarda el perfil con el rol real de la BD', async () => {
    mockIniciar.mockResolvedValue({
      perfil: {
        id_usuario: 10,
        email: 'carlos.mendez@omni.co',
        rol_id: 4,
        rol: 'moderador',
      },
    });
    const { rol } = await iniciarSesionCompleta('carlos.mendez@omni.co', 'x');
    expect(rol).toBe('moderador');
    expect(useProfileStore.getState().perfil).toMatchObject({
      nombre: 'Carlos Mendez',
      rol: 'moderador',
      idCuenta: '10',
    });
  });

  it('M01 no deja entrar a una cuenta de viajero y borra su token', async () => {
    mockIniciar.mockResolvedValue({
      perfil: {
        id_usuario: 3,
        email: 'ana@omni.co',
        rol_id: 1,
        rol: 'viajero',
      },
    });
    await expect(
      iniciarSesionCompleta('ana@omni.co', 'x', { soloModeracion: true }),
    ).rejects.toBeInstanceOf(SinPermisoModeracionError);
    expect(mockCerrar).toHaveBeenCalledTimes(1);
    expect(useProfileStore.getState().perfil).toBeNull();
  });

  it('«Moderador» con rol de moderación abre el panel', async () => {
    mockIniciar.mockResolvedValue({
      perfil: {
        id_usuario: 10,
        email: 'm@omni.co',
        rol_id: 4,
        rol: 'moderador',
      },
    });
    await iniciarSesionCompleta('m@omni.co', 'x', { soloModeracion: true });
    expect(usaPanelModeracion(useProfileStore.getState().perfil)).toBe(true);
  });

  it('«Usuario» abre la vista de viajero aunque la cuenta sea de moderación', async () => {
    mockIniciar.mockResolvedValue({
      perfil: {
        id_usuario: 10,
        email: 'm@omni.co',
        rol_id: 4,
        rol: 'moderador',
      },
    });
    await iniciarSesionCompleta('m@omni.co', 'x');
    const perfil = useProfileStore.getState().perfil;
    expect(perfil?.modo).toBe('viajero');
    expect(usaPanelModeracion(perfil)).toBe(false);
  });
});

describe('usaPanelModeracion', () => {
  it('un viajero nunca abre el panel, elija lo que elija', () => {
    expect(usaPanelModeracion({ rol: 'viajero', modo: 'moderacion' })).toBe(
      false,
    );
  });

  it('perfiles antiguos sin modo conservan el panel si su rol lo permite', () => {
    expect(usaPanelModeracion({ rol: 'administrador' })).toBe(true);
    expect(usaPanelModeracion(null)).toBe(false);
  });
});
