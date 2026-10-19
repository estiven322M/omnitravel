import {
  asegurarCaRds,
  ORIGENES_DESARROLLO,
  opcionesSsl,
  origenesCors,
  revisarSecretoJwt,
  telemetriaActiva,
  urlSinParametrosSsl,
} from './seguridad';

describe('origenesCors', () => {
  it('sin configurar permite solo Expo web local', () => {
    expect(origenesCors(undefined)).toEqual(ORIGENES_DESARROLLO);
    expect(origenesCors('  ')).toEqual(ORIGENES_DESARROLLO);
  });

  it('usa la lista configurada', () => {
    expect(
      origenesCors('https://omnitravel.app, https://admin.omnitravel.app'),
    ).toEqual(['https://omnitravel.app', 'https://admin.omnitravel.app']);
  });
});

describe('revisarSecretoJwt', () => {
  const FUERTE = 'a'.repeat(64);

  it('falla si no hay secreto', () => {
    expect(revisarSecretoJwt(undefined, 'development').error).toMatch(
      /JWT_SECRET/,
    );
  });

  it('en desarrollo solo advierte con el secreto de ejemplo', () => {
    const r = revisarSecretoJwt('cambia_esto', 'development');
    expect(r.error).toBeUndefined();
    expect(r.advertencia).toMatch(/débil/);
  });

  it('en producción rechaza secretos débiles', () => {
    expect(revisarSecretoJwt('cambia_esto', 'production').error).toMatch(
      /débil/,
    );
    expect(revisarSecretoJwt('corto123', 'production').error).toBeDefined();
  });

  it('acepta un secreto fuerte', () => {
    expect(revisarSecretoJwt(FUERTE, 'production')).toEqual({});
  });
});

describe('urlSinParametrosSsl', () => {
  it('quita sslmode y demás parámetros TLS sin tocar el resto', () => {
    expect(
      urlSinParametrosSsl(
        'postgresql://u:p%40ss@h.rds.amazonaws.com:5432/omnitravel_db?sslmode=require&application_name=api',
      ),
    ).toBe(
      'postgresql://u:p%40ss@h.rds.amazonaws.com:5432/omnitravel_db?application_name=api',
    );
  });

  it('deja intacta una URL sin parámetros TLS o vacía', () => {
    expect(urlSinParametrosSsl('postgresql://u:p@h:5432/db')).toBe(
      'postgresql://u:p@h:5432/db',
    );
    expect(urlSinParametrosSsl(undefined)).toBeUndefined();
  });
});

describe('opcionesSsl', () => {
  it('sin DB_SSL no usa TLS', () => {
    expect(opcionesSsl(undefined, undefined)).toBe(false);
  });

  it('sin CA mantiene el comportamiento actual (cifrado sin verificar)', () => {
    expect(opcionesSsl('true', undefined)).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('con el certificado pegado verifica el servidor y restaura los saltos de línea', () => {
    expect(opcionesSsl('true', '-----BEGIN CERTIFICATE-----\\nABC')).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nABC',
      rejectUnauthorized: true,
    });
  });

  it('con una ruta lee el archivo .pem (formato de main)', () => {
    const leer = jest.fn().mockReturnValue('PEM DEL ARCHIVO');
    expect(opcionesSsl('TRUE', 'certs/global-bundle.pem', leer)).toEqual({
      ca: 'PEM DEL ARCHIVO',
      rejectUnauthorized: true,
    });
    expect(leer).toHaveBeenCalledWith('certs/global-bundle.pem');
  });
});

describe('telemetriaActiva', () => {
  it('requiere ambas credenciales', () => {
    expect(telemetriaActiva({})).toBe(false);
    expect(telemetriaActiva({ OBSERVE_APP_KEY: 'k' })).toBe(false);
    expect(
      telemetriaActiva({ OBSERVE_APP_KEY: 'k', OBSERVE_APP_SECRET: 's' }),
    ).toBe(true);
  });
});

describe('asegurarCaRds', () => {
  const tmp = require('node:os').tmpdir() as string;
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');

  it('descarga la CA cuando el archivo no existe', async () => {
    const ruta = path.join(tmp, `ca-${Date.now()}`, 'global-bundle.pem');
    const descargar = jest
      .fn()
      .mockResolvedValue('-----BEGIN CERTIFICATE-----\nX');
    await asegurarCaRds('true', ruta, descargar);
    expect(descargar).toHaveBeenCalled();
    expect(fs.readFileSync(ruta, 'utf8')).toContain('BEGIN CERTIFICATE');
  });

  it('no descarga si el archivo ya existe, sin SSL o con PEM en línea', async () => {
    const ruta = path.join(tmp, `ca-existe-${Date.now()}.pem`);
    fs.writeFileSync(ruta, 'x');
    const descargar = jest.fn();
    await asegurarCaRds('true', ruta, descargar);
    await asegurarCaRds('false', '/no/existe.pem', descargar);
    await asegurarCaRds('true', '-----BEGIN CERTIFICATE-----\\nA', descargar);
    expect(descargar).not.toHaveBeenCalled();
  });

  it('explica qué hacer si la descarga falla', async () => {
    await expect(
      asegurarCaRds('true', path.join(tmp, `nada-${Date.now()}.pem`), () =>
        Promise.reject(new Error('sin red')),
      ),
    ).rejects.toThrow(/descargar-ca-rds/);
  });
});
