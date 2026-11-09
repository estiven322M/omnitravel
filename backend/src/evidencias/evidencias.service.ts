import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorDominio } from '../common/errores';

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB (RNF-28)

/** MIME permitido → extensión y firma de bytes esperada al inicio del archivo. */
const TIPOS: Record<string, { extension: string; firma: (b: Buffer) => boolean }> = {
  'image/jpeg': { extension: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { extension: 'png', firma: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': {
    extension: 'webp',
    firma: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
};

export const PATRON_USUARIO = /^\d+$/;
export const PATRON_ARCHIVO = /^\d+-[a-f0-9]{12}\.(jpg|png|webp)$/;

/** Prefijo de las fotos dentro del bucket de S3. */
export const PREFIJO_S3 = 'evidencia/';

/** Lo que el controlador necesita para devolver una foto guardada en S3. */
export interface FotoS3 {
  cuerpo: Readable;
  tipo: string;
}

/**
 * Evidencia fotográfica (ADR-07 del C4: almacenamiento de objetos).
 *
 * - Con `EVIDENCIAS_BUCKET` (producción en AWS) las fotos van a Amazon S3 en
 *   `evidencia/<id_usuario>/<archivo>`; el bucket es privado y el backend las
 *   sirve, con el rol de la tarea de ECS (sin claves en el código).
 * - Sin bucket (desarrollo local) se guardan en `<EVIDENCIAS_DIR>/<id_usuario>/<archivo>`.
 *
 * La `storage_key` registrada en la tabla `evidencia` es `<id_usuario>/<archivo>`
 * en ambos casos, así que cambiar de almacenamiento no cambia los datos.
 */
@Injectable()
export class EvidenciasService {
  readonly directorio: string;
  readonly bucket: string | null;
  private readonly s3: S3Client | null;

  constructor(config: ConfigService, @Optional() s3?: S3Client) {
    this.directorio = resolve(config.get<string>('EVIDENCIAS_DIR') ?? 'uploads/evidencia');
    this.bucket = config.get<string>('EVIDENCIAS_BUCKET')?.trim() || null;
    this.s3 = this.bucket ? (s3 ?? new S3Client({})) : null;
  }

  async guardar(usuarioId: string, base64?: unknown, mimeType?: unknown) {
    const tipo = typeof mimeType === 'string' ? TIPOS[mimeType] : undefined;
    if (!tipo || typeof base64 !== 'string' || !base64) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'FILE_REJECTED',
        'Solo se aceptan fotos JPG, PNG o WEBP.',
      );
    }

    const contenido = Buffer.from(base64, 'base64');
    if (contenido.length === 0 || contenido.length > TAMANO_MAXIMO) {
      throw errorDominio(HttpStatus.BAD_REQUEST, 'FILE_REJECTED', 'La foto supera los 5 MB.');
    }
    if (!tipo.firma(contenido)) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'FILE_REJECTED',
        'El archivo no corresponde a una imagen válida.',
      );
    }

    const archivo = `${Date.now()}-${randomBytes(6).toString('hex')}.${tipo.extension}`;
    const storageKey = `${usuarioId}/${archivo}`;

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `${PREFIJO_S3}${storageKey}`,
          Body: contenido,
          ContentType: mimeType as string,
        }),
      );
    } else {
      const carpeta = join(this.directorio, usuarioId);
      await mkdir(carpeta, { recursive: true });
      await writeFile(join(carpeta, archivo), contenido);
    }

    return { storageKey };
  }

  /** Lee una foto de S3; null si no existe o no hay bucket configurado. */
  async leerDeS3(storageKey: string): Promise<FotoS3 | null> {
    if (!this.s3 || !this.bucket) {
      return null;
    }
    try {
      const respuesta = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: `${PREFIJO_S3}${storageKey}` }),
      );
      if (!respuesta.Body) {
        return null;
      }
      return {
        cuerpo: respuesta.Body as Readable,
        tipo: respuesta.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      const nombre = (error as { name?: string })?.name;
      if (nombre === 'NoSuchKey' || nombre === 'NotFound') {
        return null;
      }
      throw error;
    }
  }
}
