import { webcrypto } from 'node:crypto';
import {
  crearAlmacenCifrado,
  type AlmacenTexto,
} from '../services/almacenamiento.web';

/** localStorage en memoria para observar exactamente qué se guarda. */
function almacenEnMemoria(): AlmacenTexto & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => void datos.set(clave, valor),
    removeItem: (clave) => void datos.delete(clave),
  };
}

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const aleatorio = (bytes: Uint8Array<ArrayBuffer>) => {
  webcrypto.getRandomValues(bytes);
  return bytes;
};
const nuevaLlave = () =>
  subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]) as Promise<CryptoKey>;

const PERFIL = JSON.stringify({
  perfil: { discapacidad: 'movilidad_reducida', usaSillaDeRuedas: true },
});

describe('almacenamiento web cifrado (ADR-09, auditoría 6.7 ítem 3)', () => {
  it('guarda el perfil cifrado: el texto en claro no aparece en localStorage', async () => {
    const almacen = almacenEnMemoria();
    const llave = await nuevaLlave();
    const seguro = crearAlmacenCifrado({
      almacen,
      subtle,
      aleatorio,
      obtenerLlave: async () => llave,
    });

    await seguro.setItemAsync('perfil', PERFIL);

    const guardado = almacen.datos.get('perfil') ?? '';
    expect(guardado.startsWith('enc:v1:')).toBe(true);
    expect(guardado).not.toContain('movilidad_reducida');
    await expect(seguro.getItemAsync('perfil')).resolves.toBe(PERFIL);
  });

  it('con otra llave (datos del navegador borrados) no se puede leer', async () => {
    const almacen = almacenEnMemoria();
    const primera = crearAlmacenCifrado({
      almacen,
      subtle,
      aleatorio,
      obtenerLlave: nuevaLlave,
    });
    await primera.setItemAsync('perfil', PERFIL);
    const otra = await nuevaLlave();
    const segunda = crearAlmacenCifrado({
      almacen,
      subtle,
      aleatorio,
      obtenerLlave: async () => otra,
    });
    await expect(segunda.getItemAsync('perfil')).resolves.toBeNull();
  });

  it('cifra al leer los valores heredados que estaban en claro', async () => {
    const almacen = almacenEnMemoria();
    almacen.setItem('perfil', PERFIL);
    const llave = await nuevaLlave();
    const seguro = crearAlmacenCifrado({
      almacen,
      subtle,
      aleatorio,
      obtenerLlave: async () => llave,
    });

    await expect(seguro.getItemAsync('perfil')).resolves.toBe(PERFIL);
    expect(almacen.datos.get('perfil')).toMatch(/^enc:v1:/);
  });

  it('sin Web Crypto no guarda nada en claro: solo en memoria', async () => {
    const almacen = almacenEnMemoria();
    const seguro = crearAlmacenCifrado({
      almacen,
      subtle: null,
      aleatorio,
      obtenerLlave: async () => null,
    });

    await seguro.setItemAsync('perfil', PERFIL);

    expect(almacen.datos.size).toBe(0);
    await expect(seguro.getItemAsync('perfil')).resolves.toBe(PERFIL);
    await seguro.deleteItemAsync('perfil');
    await expect(seguro.getItemAsync('perfil')).resolves.toBeNull();
  });
});
