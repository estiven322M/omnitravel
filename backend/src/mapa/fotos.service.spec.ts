import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AGENTE_WIKIMEDIA, FotosService } from './fotos.service';

const URL_FOTO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Estacion.JPG/1280px-Estacion.JPG';

function crear(url: string | null, respuesta?: Partial<Response>) {
  const query = jest.fn().mockResolvedValue(url ? [{ url }] : []);
  const servicio = new FotosService({ query } as unknown as DataSource);
  const fetchFn = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff]).buffer),
    ...respuesta,
  });
  servicio.fetchFn = fetchFn as unknown as typeof fetch;
  return { servicio, query, fetchFn };
}

async function codigo(promesa: Promise<unknown>) {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return ((error as HttpException).getResponse() as { error: string }).error;
}

describe('FotosService — fotos de los lugares servidas por la API', () => {
  it('descarga la foto de Wikimedia con agente identificado', async () => {
    const { servicio, fetchFn } = crear(URL_FOTO);
    const foto = await servicio.obtener('7');
    expect(foto.tipo).toBe('image/jpeg');
    expect(foto.datos.length).toBe(3);
    const [, init] = fetchFn.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(AGENTE_WIKIMEDIA);
  });

  it('la segunda vez usa la copia en memoria', async () => {
    const { servicio, fetchFn, query } = crear(URL_FOTO);
    await servicio.obtener(7);
    await servicio.obtener(7);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('responde 404 si la foto no existe', async () => {
    const { servicio } = crear(null);
    expect(await codigo(servicio.obtener(99))).toBe('FOTO_NO_ENCONTRADA');
  });

  it('no actúa como proxy abierto: rechaza otros dominios', async () => {
    const { servicio, fetchFn } = crear('https://ejemplo.com/foto.jpg');
    expect(await codigo(servicio.obtener(3))).toBe('FOTO_NO_DISPONIBLE');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('si Wikimedia responde con error no entrega nada', async () => {
    const { servicio } = crear(URL_FOTO, {
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'text/plain' }),
    });
    expect(await codigo(servicio.obtener(4))).toBe('FOTO_NO_DISPONIBLE');
  });

  it('rechaza identificadores inválidos sin consultar la base', async () => {
    const { servicio, query } = crear(URL_FOTO);
    expect(await codigo(servicio.obtener('abc'))).toBe('FOTO_INVALIDA');
    expect(query).not.toHaveBeenCalled();
  });
});
