import { MapaService } from './mapa.service';

function servicio() {
  const query = jest.fn().mockResolvedValue([]);
  const s = new MapaService({ query } as never);
  return { s, query };
}

describe('MapaService · copia en memoria (RNF-02)', () => {
  const previo = process.env.MAPA_CACHE_MS;
  afterEach(() => {
    process.env.MAPA_CACHE_MS = previo;
  });

  it('peticiones simultáneas comparten una sola consulta a la base', async () => {
    process.env.MAPA_CACHE_MS = '3000';
    const { s, query } = servicio();
    await Promise.all(Array.from({ length: 50 }, () => s.datos()));
    expect(query).toHaveBeenCalledTimes(7); // 6 tablas + fotos, una sola vez
  });

  it('invalidar obliga a consultar de nuevo', async () => {
    process.env.MAPA_CACHE_MS = '3000';
    const { s, query } = servicio();
    await s.datos();
    s.invalidar();
    await s.datos();
    expect(query).toHaveBeenCalledTimes(14);
  });

  it('con MAPA_CACHE_MS=0 cada petición consulta la base', async () => {
    process.env.MAPA_CACHE_MS = '0';
    const { s, query } = servicio();
    await s.datos();
    await s.datos();
    expect(query).toHaveBeenCalledTimes(14);
  });
});
