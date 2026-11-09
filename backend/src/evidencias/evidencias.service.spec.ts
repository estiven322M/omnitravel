import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { S3Client } from '@aws-sdk/client-s3';
import { EvidenciasService, PREFIJO_S3 } from './evidencias.service';

/** Evidencia fotográfica en S3 (ADR-07, RNF-28). El cliente de S3 es simulado. */
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

function crear(bucket?: string) {
  const send = jest.fn().mockResolvedValue({});
  const config = {
    get: (clave: string) => (clave === 'EVIDENCIAS_BUCKET' ? bucket : undefined),
  } as unknown as ConfigService;
  const servicio = new EvidenciasService(config, { send } as unknown as S3Client);
  return { servicio, send };
}

describe('EvidenciasService — almacenamiento en S3', () => {
  it('con bucket sube la foto a S3 bajo evidencia/<usuario>/ y devuelve la storage_key', async () => {
    const { servicio, send } = crear('omnitravel-evidencias');
    const { storageKey } = await servicio.guardar('5', JPG, 'image/jpeg');

    expect(storageKey).toMatch(/^5\/\d+-[a-f0-9]{12}\.jpg$/);
    const comando = send.mock.calls[0][0].input;
    expect(comando.Bucket).toBe('omnitravel-evidencias');
    expect(comando.Key).toBe(`${PREFIJO_S3}${storageKey}`);
    expect(comando.ContentType).toBe('image/jpeg');
  });

  it('rechaza archivos que no son imagen antes de llamar a S3', async () => {
    const { servicio, send } = crear('omnitravel-evidencias');
    const error = await servicio
      .guardar('5', Buffer.from('hola').toString('base64'), 'image/jpeg')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(send).not.toHaveBeenCalled();
  });

  it('leerDeS3 devuelve null si la foto no existe', async () => {
    const { servicio, send } = crear('omnitravel-evidencias');
    send.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NoSuchKey' }));
    await expect(servicio.leerDeS3('5/1-abcdefabcdef.jpg')).resolves.toBeNull();
  });

  it('sin bucket no usa S3 (desarrollo local con disco)', async () => {
    const { servicio } = crear(undefined);
    expect(servicio.bucket).toBeNull();
    await expect(servicio.leerDeS3('5/1-abcdefabcdef.jpg')).resolves.toBeNull();
  });
});
