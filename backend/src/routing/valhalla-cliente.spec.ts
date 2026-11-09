import { HttpException } from '@nestjs/common';
import { consultarValhalla } from './valhalla-cliente';

const RUTA = { trip: { summary: { length: 1.2 } } };

function respuesta(status: number, cuerpo: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(cuerpo),
  } as Response;
}

function preparar(...resultados: (Response | Error)[]) {
  const fetchFn = jest.fn();
  for (const r of resultados) {
    if (!('status' in r)) fetchFn.mockRejectedValueOnce(r);
    else fetchFn.mockResolvedValueOnce(r);
  }
  const dormir = jest.fn().mockResolvedValue(undefined);
  return { fetchFn, dormir };
}

async function codigoDe(promesa: Promise<unknown>) {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  return {
    estado: http.getStatus(),
    codigo: (http.getResponse() as { error: string }).error,
  };
}

describe('consultarValhalla', () => {
  it('devuelve la ruta en el primer intento y envía un tiempo límite', async () => {
    const { fetchFn, dormir } = preparar(respuesta(200, RUTA));
    await expect(
      consultarValhalla('http://v', {}, { fetchFn, dormir }),
    ).resolves.toEqual(RUTA);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe('http://v/route');
    expect(fetchFn.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('reintenta ante fallas de red, tiempo agotado y 5xx', async () => {
    const { fetchFn, dormir } = preparar(
      new Error('ECONNRESET'),
      respuesta(503),
      respuesta(200, RUTA),
    );
    await expect(
      consultarValhalla('http://v', {}, { fetchFn, dormir }),
    ).resolves.toEqual(RUTA);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(dormir.mock.calls).toEqual([[500], [1000]]);
  });

  it('tras agotar los intentos responde 503 RUTEO_NO_DISPONIBLE', async () => {
    const tiempo = new DOMException('timeout', 'TimeoutError');
    const { fetchFn, dormir } = preparar(
      tiempo as unknown as Error,
      respuesta(429),
      respuesta(502),
    );
    expect(
      await codigoDe(consultarValhalla('http://v', {}, { fetchFn, dormir })),
    ).toEqual({
      estado: 503,
      codigo: 'RUTEO_NO_DISPONIBLE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('no reintenta un 400 de Valhalla (no hay camino) y responde 422', async () => {
    const { fetchFn, dormir } = preparar(respuesta(400));
    expect(
      await codigoDe(consultarValhalla('http://v', {}, { fetchFn, dormir })),
    ).toEqual({
      estado: 422,
      codigo: 'RUTA_NO_ENCONTRADA',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(dormir).not.toHaveBeenCalled();
  });
});
