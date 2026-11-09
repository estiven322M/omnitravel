import {
  firmaValida,
  firmarEvidencia,
  VIGENCIA_SEGUNDOS,
} from './firma-evidencia';

const SECRETO = 'a'.repeat(40);
const FOTO = '7/1700000000000-abcdef123456.jpg';
const AHORA = Date.UTC(2026, 10, 8, 15, 20); // 8 nov 2026, 10:20 en Bogotá

function partes(query: string) {
  const params = new URLSearchParams(query);
  return { exp: params.get('exp') ?? '', firma: params.get('firma') ?? '' };
}

describe('firmarEvidencia / firmaValida', () => {
  it('acepta la firma recién emitida para la misma foto', () => {
    const { exp, firma } = partes(firmarEvidencia(FOTO, SECRETO, AHORA));
    expect(firmaValida(FOTO, exp, firma, SECRETO, AHORA)).toBe(true);
  });

  it('vence entre 1 y 2 horas después y es estable dentro de la misma hora', () => {
    const { exp } = partes(firmarEvidencia(FOTO, SECRETO, AHORA));
    const segundos = Number(exp) - AHORA / 1000;
    expect(segundos).toBeGreaterThan(VIGENCIA_SEGUNDOS);
    expect(segundos).toBeLessThanOrEqual(2 * VIGENCIA_SEGUNDOS);
    expect(firmarEvidencia(FOTO, SECRETO, AHORA + 60_000)).toBe(
      firmarEvidencia(FOTO, SECRETO, AHORA),
    );
  });

  it('rechaza la firma vencida', () => {
    const { exp, firma } = partes(firmarEvidencia(FOTO, SECRETO, AHORA));
    expect(firmaValida(FOTO, exp, firma, SECRETO, Number(exp) * 1000)).toBe(
      false,
    );
  });

  it('rechaza la firma de otra foto, otro secreto o una vigencia alterada', () => {
    const { exp, firma } = partes(firmarEvidencia(FOTO, SECRETO, AHORA));
    expect(
      firmaValida(
        '8/1700000000000-abcdef123456.jpg',
        exp,
        firma,
        SECRETO,
        AHORA,
      ),
    ).toBe(false);
    expect(firmaValida(FOTO, exp, firma, 'b'.repeat(40), AHORA)).toBe(false);
    expect(
      firmaValida(FOTO, String(Number(exp) + 3600), firma, SECRETO, AHORA),
    ).toBe(false);
  });

  it('rechaza parámetros ausentes o mal formados', () => {
    expect(firmaValida(FOTO, undefined, undefined, SECRETO, AHORA)).toBe(false);
    expect(firmaValida(FOTO, ['1'], 'x', SECRETO, AHORA)).toBe(false);
    expect(firmaValida(FOTO, '12abc', 'x', SECRETO, AHORA)).toBe(false);
    expect(firmaValida(FOTO, '9999999999', 'corta', SECRETO, AHORA)).toBe(
      false,
    );
  });
});
