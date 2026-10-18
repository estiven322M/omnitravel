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
});
