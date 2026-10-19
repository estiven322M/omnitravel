import type { AlertButton } from 'react-native';

/**
 * Versión web de `Alert.alert` (ver `alerta.ts`).
 *
 * - Sin botones o con uno: `window.alert` y luego su `onPress`.
 * - Con dos o más: `window.confirm`. «Aceptar» ejecuta el último botón que no
 *   sea de cancelar; «Cancelar» ejecuta el de cancelar (si tiene acción).
 */
function alert(titulo: string, mensaje?: string, botones?: AlertButton[]) {
  const texto = mensaje ? `${titulo}\n\n${mensaje}` : titulo;
  const lista = botones ?? [];

  if (lista.length <= 1) {
    window.alert(texto);
    lista[0]?.onPress?.();
    return;
  }

  const cancelar = lista.find((boton) => boton.style === 'cancel');
  const aceptar = [...lista].reverse().find((boton) => boton !== cancelar);
  if (window.confirm(texto)) {
    aceptar?.onPress?.();
  } else {
    cancelar?.onPress?.();
  }
}

export const Alerta = { alert };
