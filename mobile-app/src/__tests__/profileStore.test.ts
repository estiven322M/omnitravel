import * as SecureStore from 'expo-secure-store';
import { useProfileStore } from '../store/profileStore';

jest.mock('expo-secure-store', () => {
  const almacen = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (clave: string) => almacen.get(clave) ?? null),
    setItemAsync: jest.fn(async (clave: string, valor: string) => {
      almacen.set(clave, valor);
    }),
    deleteItemAsync: jest.fn(async (clave: string) => {
      almacen.delete(clave);
    }),
  };
});

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({ perfil: null, hidratado: true });
    jest.clearAllMocks();
  });

  it('guarda el perfil con fecha de creación', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: ['visual'],
      filtrosActivos: [],
    });

    const perfil = useProfileStore.getState().perfil;
    expect(perfil?.nombre).toBe('Ana');
    expect(perfil?.necesidades).toEqual(['visual']);
    expect(perfil?.creadoEn).toBeTruthy();
  });

  it('degrada el rol a viajero cuando no se especifica (mínimo privilegio)', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
    });

    expect(useProfileStore.getState().perfil?.rol).toBe('viajero');
  });

  it('conserva el rol de moderación al guardar el perfil', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Mod',
      necesidades: [],
      filtrosActivos: [],
      rol: 'moderador',
    });

    expect(useProfileStore.getState().perfil?.rol).toBe('moderador');
  });

  it('persiste el perfil en el almacenamiento seguro del dispositivo', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'omnitravel-perfil',
      expect.stringContaining('Ana'),
    );
  });

  it('alterna filtros activos (agrega y quita)', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
    });

    useProfileStore.getState().alternarFiltro('menu_braille');
    expect(useProfileStore.getState().perfil?.filtrosActivos).toEqual([
      'menu_braille',
    ]);

    useProfileStore.getState().alternarFiltro('menu_braille');
    expect(useProfileStore.getState().perfil?.filtrosActivos).toEqual([]);
  });

  it('establece la lista completa de filtros', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
    });

    useProfileStore
      .getState()
      .establecerFiltros(['sin_escalones', 'ascensor_amplio']);

    expect(useProfileStore.getState().perfil?.filtrosActivos).toEqual([
      'sin_escalones',
      'ascensor_amplio',
    ]);
  });

  it('cerrar sesión elimina el perfil', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
    });

    useProfileStore.getState().cerrarSesion();
    expect(useProfileStore.getState().perfil).toBeNull();
  });

  it('no modifica filtros si no hay perfil', () => {
    useProfileStore.getState().alternarFiltro('menu_braille');
    expect(useProfileStore.getState().perfil).toBeNull();
  });

  it('conserva la foto solo entre sesiones de la misma cuenta', () => {
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '1',
    });
    useProfileStore.getState().establecerFoto('file:///doc/perfil-foto-1.jpg');

    // Relanzamiento de la MISMA cuenta: la foto se arrastra.
    useProfileStore.getState().guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '1',
    });
    expect(useProfileStore.getState().perfil?.fotoUri).toBe(
      'file:///doc/perfil-foto-1.jpg',
    );

    // Otra cuenta no hereda la foto de la anterior (issue del equipo).
    useProfileStore.getState().guardarPerfil({
      nombre: 'Luis',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '2',
    });
    expect(useProfileStore.getState().perfil?.fotoUri).toBeUndefined();
    expect(useProfileStore.getState().perfil?.idCuenta).toBe('2');
  });
});

describe('filtros de accesibilidad por cuenta', () => {
  beforeEach(() => {
    useProfileStore.setState({ perfil: null, preferencias: undefined });
  });

  it('se conservan al cerrar sesión y volver a entrar con la misma cuenta', () => {
    const { guardarPerfil, establecerFiltros, cerrarSesion } =
      useProfileStore.getState();
    guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '7',
    });
    establecerFiltros(['sin_escalones', 'ascensor_amplio']);
    cerrarSesion();

    // El inicio de sesión no conoce los filtros: llegan vacíos.
    guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '7',
    });
    expect(useProfileStore.getState().perfil?.filtrosActivos).toEqual([
      'sin_escalones',
      'ascensor_amplio',
    ]);
  });

  it('no se mezclan entre cuentas distintas', () => {
    const { guardarPerfil, establecerFiltros } = useProfileStore.getState();
    guardarPerfil({
      nombre: 'Ana',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '7',
    });
    establecerFiltros(['sin_escalones']);
    guardarPerfil({
      nombre: 'Beto',
      necesidades: [],
      filtrosActivos: [],
      idCuenta: '8',
    });
    expect(useProfileStore.getState().perfil?.filtrosActivos).toEqual([]);
  });
});
