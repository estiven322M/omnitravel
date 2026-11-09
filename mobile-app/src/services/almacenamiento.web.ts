/**
 * Versión web del almacenamiento seguro (`almacenamiento.ts`).
 *
 * En el teléfono, `expo-secure-store` cifra con el Keychain / Keystore. El
 * navegador no tiene ese llavero, así que aquí (auditoría 6.7 ítem 3, ADR-09):
 *
 * - Cada valor (perfil de accesibilidad, sesión) se cifra con AES-GCM de 256
 *   bits (Web Crypto) antes de guardarse en `localStorage`.
 * - La llave se genera en el navegador como NO EXPORTABLE y se guarda en
 *   IndexedDB: ni siquiera el código de la página puede leer sus bytes.
 * - Si el navegador no ofrece Web Crypto o IndexedDB (modo privado, navegador
 *   antiguo), NO se guarda nada en claro: los datos viven solo en memoria
 *   mientras la pestaña esté abierta.
 * - Los valores guardados en claro por versiones anteriores se cifran la
 *   primera vez que se leen.
 */

const PREFIJO = 'enc:v1:';

/** Almacén de texto mínimo (localStorage o uno en memoria en las pruebas). */
export interface AlmacenTexto {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export interface DependenciasCifrado {
  almacen: AlmacenTexto | null;
  subtle: SubtleCrypto | null;
  obtenerLlave: () => Promise<CryptoKey | null>;
  aleatorio: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

const aBase64 = (bytes: ArrayBuffer | Uint8Array) => {
  let texto = '';
  new Uint8Array(bytes).forEach((b) => (texto += String.fromCharCode(b)));
  return btoa(texto);
};
const deBase64 = (texto: string) =>
  Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

/** Fábrica testeable: la app usa la instancia por defecto de más abajo. */
export function crearAlmacenCifrado(dependencias: DependenciasCifrado) {
  const { almacen, subtle, obtenerLlave, aleatorio } = dependencias;
  const enMemoria = new Map<string, string>();
  const codificador = new TextEncoder();
  const decodificador = new TextDecoder();

  async function llave(): Promise<CryptoKey | null> {
    if (!almacen || !subtle) return null;
    try {
      return await obtenerLlave();
    } catch {
      return null;
    }
  }

  async function cifrar(clave: CryptoKey, valor: string): Promise<string> {
    const iv = aleatorio(new Uint8Array(12));
    const datos = await subtle!.encrypt(
      { name: 'AES-GCM', iv },
      clave,
      codificador.encode(valor),
    );
    return `${PREFIJO}${aBase64(iv)}:${aBase64(datos)}`;
  }

  async function descifrar(
    clave: CryptoKey,
    guardado: string,
  ): Promise<string | null> {
    const [iv, datos] = guardado.slice(PREFIJO.length).split(':');
    try {
      const plano = await subtle!.decrypt(
        { name: 'AES-GCM', iv: deBase64(iv) },
        clave,
        deBase64(datos),
      );
      return decodificador.decode(plano);
    } catch {
      // Llave distinta (datos borrados del navegador) o valor alterado.
      return null;
    }
  }

  return {
    async getItemAsync(clave: string): Promise<string | null> {
      const llaveActual = await llave();
      if (!llaveActual) return enMemoria.get(clave) ?? null;
      let guardado: string | null = null;
      try {
        guardado = almacen!.getItem(clave);
      } catch {
        return null;
      }
      if (guardado === null) return null;
      if (!guardado.startsWith(PREFIJO)) {
        // Valor heredado en claro: se cifra ahora y se devuelve.
        await this.setItemAsync(clave, guardado);
        return guardado;
      }
      return descifrar(llaveActual, guardado);
    },

    async setItemAsync(clave: string, valor: string): Promise<void> {
      const llaveActual = await llave();
      if (!llaveActual) {
        enMemoria.set(clave, valor);
        return;
      }
      try {
        almacen!.setItem(clave, await cifrar(llaveActual, valor));
      } catch {
        enMemoria.set(clave, valor);
      }
    },

    async deleteItemAsync(clave: string): Promise<void> {
      enMemoria.delete(clave);
      try {
        almacen?.removeItem(clave);
      } catch {
        // Nada que borrar.
      }
    },
  };
}

/** Llave AES-GCM no exportable, creada una vez y guardada en IndexedDB. */
function llaveDelNavegador(): Promise<CryptoKey | null> {
  return new Promise((resolver, rechazar) => {
    if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) {
      resolver(null);
      return;
    }
    const apertura = indexedDB.open('omnitravel-llaves', 1);
    apertura.onupgradeneeded = () =>
      apertura.result.createObjectStore('llaves');
    apertura.onerror = () => rechazar(apertura.error);
    apertura.onsuccess = () => {
      const bd = apertura.result;
      const lectura = bd
        .transaction('llaves', 'readonly')
        .objectStore('llaves')
        .get('almacenamiento');
      lectura.onerror = () => rechazar(lectura.error);
      lectura.onsuccess = async () => {
        if (lectura.result) {
          resolver(lectura.result as CryptoKey);
          return;
        }
        try {
          const nueva = await globalThis.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
          );
          const escritura = bd
            .transaction('llaves', 'readwrite')
            .objectStore('llaves')
            .put(nueva, 'almacenamiento');
          escritura.onsuccess = () => resolver(nueva);
          escritura.onerror = () => rechazar(escritura.error);
        } catch (error) {
          rechazar(error);
        }
      };
    };
  });
}

let llaveEnCurso: Promise<CryptoKey | null> | null = null;

const porDefecto = crearAlmacenCifrado({
  almacen: (() => {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
      return null;
    }
  })(),
  subtle: globalThis.crypto?.subtle ?? null,
  obtenerLlave: () => (llaveEnCurso ??= llaveDelNavegador()),
  aleatorio: (bytes) => globalThis.crypto.getRandomValues(bytes),
});

export function getItemAsync(
  clave: string,
  _opciones?: unknown,
): Promise<string | null> {
  return porDefecto.getItemAsync(clave);
}

export function setItemAsync(
  clave: string,
  valor: string,
  _opciones?: unknown,
): Promise<void> {
  return porDefecto.setItemAsync(clave, valor);
}

export function deleteItemAsync(
  clave: string,
  _opciones?: unknown,
): Promise<void> {
  return porDefecto.deleteItemAsync(clave);
}

/** El navegador no ofrece huella / Face ID para el llavero: se oculta. */
export function canUseBiometricAuthentication(): boolean {
  return false;
}
