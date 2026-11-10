import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { errorDominio } from '../common/errores';

/**
 * Agente identificado para Wikimedia Commons: su política de uso rechaza
 * (HTTP 403) a los clientes genéricos, como el de las apps Android (okhttp).
 */
export const AGENTE_WIKIMEDIA =
  'OmniTravel/1.0 (proyecto academico de turismo accesible, Universidad del Quindio; https://github.com/estiven322M/omnitravel)';

/** Solo se sirven fotos de estos dominios (no es un proxy abierto). */
const DOMINIOS_PERMITIDOS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];
const MAX_EN_CACHE = 80;
const MAX_BYTES = 5 * 1024 * 1024;

export interface FotoServida {
  datos: Buffer;
  tipo: string;
}

/**
 * GET /fotos/:id — sirve las fotos de los lugares (tabla poi_foto) desde la
 * API: la app ya no las pide directamente a Wikimedia, que bloquea a Android.
 * Guarda en memoria las más recientes para no repetir descargas.
 */
@Injectable()
export class FotosService {
  private readonly logger = new Logger(FotosService.name);
  private readonly cache = new Map<number, FotoServida>();
  /** Reemplazable en las pruebas. */
  fetchFn: typeof fetch = (entrada, init) => fetch(entrada, init);

  constructor(@InjectDataSource() private readonly db: DataSource) { }

  async obtener(idRaw: unknown): Promise<FotoServida> {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      throw errorDominio(HttpStatus.BAD_REQUEST, 'FOTO_INVALIDA', 'El identificador de la foto no es válido.');
    }
    const enCache = this.cache.get(id);
    if (enCache) {
      return enCache;
    }

    const [fila] = (await this.db.query('select url from poi_foto where id_foto = $1', [id])) as { url: string }[];
    if (!fila) {
      throw errorDominio(HttpStatus.NOT_FOUND, 'FOTO_NO_ENCONTRADA', 'La foto no existe.');
    }
    let url: URL;
    try {
      url = new URL(fila.url);
    } catch {
      throw errorDominio(HttpStatus.BAD_GATEWAY, 'FOTO_NO_DISPONIBLE', 'La foto no está disponible.');
    }
    if (url.protocol !== 'https:' || !DOMINIOS_PERMITIDOS.includes(url.hostname)) {
      throw errorDominio(HttpStatus.BAD_GATEWAY, 'FOTO_NO_DISPONIBLE', 'La foto no está disponible.');
    }

    let respuesta: Response;
    try {
      respuesta = await this.fetchFn(url, {
        headers: { 'User-Agent': AGENTE_WIKIMEDIA },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.warn(`Foto ${id}: ${(error as Error).message}`);
      throw errorDominio(HttpStatus.BAD_GATEWAY, 'FOTO_NO_DISPONIBLE', 'La foto no está disponible.');
    }
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (!respuesta.ok || !tipo.startsWith('image/')) {
      this.logger.warn(`Foto ${id}: HTTP ${respuesta.status} (${tipo})`);
      throw errorDominio(HttpStatus.BAD_GATEWAY, 'FOTO_NO_DISPONIBLE', 'La foto no está disponible.');
    }
    const datos = Buffer.from(await respuesta.arrayBuffer());
    if (datos.length > MAX_BYTES) {
      throw errorDominio(HttpStatus.BAD_GATEWAY, 'FOTO_NO_DISPONIBLE', 'La foto es demasiado grande.');
    }

    const foto = { datos, tipo };
    if (this.cache.size >= MAX_EN_CACHE) {
      this.cache.delete(this.cache.keys().next().value as number);
    }
    this.cache.set(id, foto);
    return foto;
  }
}
