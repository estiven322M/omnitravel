import { Alerta } from '../utils/alerta.web';

describe('Alerta en el navegador', () => {
  const confirmar = jest.fn();
  const avisar = jest.fn();

  beforeEach(() => {
    confirmar.mockReset();
    avisar.mockReset();
    (globalThis as unknown as { window: unknown }).window = {
      confirm: confirmar,
      alert: avisar,
    };
  });

  it('ejecuta la acción al confirmar (p. ej. cerrar sesión)', () => {
    confirmar.mockReturnValue(true);
    const salir = jest.fn();
    const cancelar = jest.fn();
    Alerta.alert('Cerrar sesión', '¿Quieres salir?', [
      { text: 'Cancelar', style: 'cancel', onPress: cancelar },
      { text: 'Cerrar sesión', style: 'destructive', onPress: salir },
    ]);
    expect(salir).toHaveBeenCalled();
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('no ejecuta la acción si se cancela', () => {
    confirmar.mockReturnValue(false);
    const salir = jest.fn();
    Alerta.alert('Cerrar sesión', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', onPress: salir },
    ]);
    expect(salir).not.toHaveBeenCalled();
  });

  it('un aviso simple usa window.alert y su botón', () => {
    const entendido = jest.fn();
    Alerta.alert('Listo', 'Guardado', [
      { text: 'Entendido', onPress: entendido },
    ]);
    expect(avisar).toHaveBeenCalledWith('Listo\n\nGuardado');
    expect(entendido).toHaveBeenCalled();
  });
});
