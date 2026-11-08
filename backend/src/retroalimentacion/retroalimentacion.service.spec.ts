import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  debeEscalar,
  gravedadDe,
  RetroalimentacionService,
  TIPO_CALIFICACION_BAJA,
  validarRetroalimentacion,
} from './retroalimentacion.service';

/**
 * Proceso 3 — Gestión de Retroalimentación e Incidencias Post-Viaje
 * (RF-03, RNF-05, RNF-10, RNF-19). BD simulada: `query` responde en el orden
 * en que el servicio consulta; la transacción reutiliza el mismo mock.
 */
function crearDb(respuestas: unknown[][]) {
  const query = jest.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const db = {
    query,
    transaction: jest.fn((trabajo: (m: { query: jest.Mock }) => unknown) =>
      trabajo({ query }),
    ),
  };
  return { db: db as unknown as DataSource, query };
}

function capturarSync(fn: () => unknown): HttpException {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return e as HttpException;
  }
  throw new Error('Se esperaba un error');
}

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

const codigo = (error: HttpException) =>
  (error.getResponse() as { error: string }).error;

const BASE = { poiId: 7, calificacion: 4, comentario: 'Rampa en buen estado' };
const DISCREPANCIA = {
  ...BASE,
  calificacion: 2,
  coincide: false,
  tipoDiscrepancia: 'barrera_nueva',
  descripcionDiscrepancia: 'La rampa de la entrada está bloqueada por obras.',
};

describe('RetroalimentacionService — Proceso 3: retroalimentación post-viaje', () => {
  describe('validación de la retroalimentación', () => {
    it('CP-U301 rechaza una retroalimentación sin lugar (400 DATOS_INCOMPLETOS)', () => {
      const error = capturarSync(() =>
        validarRetroalimentacion({ ...BASE, poiId: null }),
      );
      expect(error.getStatus()).toBe(400);
      expect(codigo(error)).toBe('DATOS_INCOMPLETOS');
    });

    it.each([0, 6, 3.5, Number.NaN])(
      'CP-U302 rechaza la calificación fuera de 1–5 o no entera (%p)',
      (calificacion) => {
        const error = capturarSync(() =>
          validarRetroalimentacion({ ...BASE, calificacion }),
        );
        expect(codigo(error)).toBe('CALIFICACION_INVALIDA');
      },
    );

    it('CP-U303 acepta los valores límite 1 y 5 (valores frontera)', () => {
      expect(
        validarRetroalimentacion({ ...BASE, calificacion: 1 }).calificacion,
      ).toBe(1);
      expect(
        validarRetroalimentacion({ ...BASE, calificacion: 5 }).calificacion,
      ).toBe(5);
    });

    it('CP-U304 rechaza un comentario de más de 500 caracteres', () => {
      const error = capturarSync(() =>
        validarRetroalimentacion({ ...BASE, comentario: 'a'.repeat(501) }),
      );
      expect(codigo(error)).toBe('COMENTARIO_MUY_LARGO');
    });

    it('CP-U305 una discrepancia exige un tipo válido', () => {
      const error = capturarSync(() =>
        validarRetroalimentacion({
          ...DISCREPANCIA,
          tipoDiscrepancia: 'inventado',
        }),
      );
      expect(codigo(error)).toBe('TIPO_DISCREPANCIA_INVALIDO');
    });

    it('CP-U306 una discrepancia exige descripción de al menos 10 caracteres', () => {
      const error = capturarSync(() =>
        validarRetroalimentacion({
          ...DISCREPANCIA,
          descripcionDiscrepancia: 'mal',
        }),
      );
      expect(codigo(error)).toBe('DESCRIPCION_REQUERIDA');
    });

    it('CP-U307 normaliza espacios y deja la discrepancia en null si todo coincidía', () => {
      const valida = validarRetroalimentacion({
        ...BASE,
        poiId: ' 7 ',
        comentario: '  Bien  ',
      });
      expect(valida).toEqual({
        poiId: '7',
        calificacion: 4,
        comentario: 'Bien',
        discrepancia: null,
      });
    });
  });

  describe('reglas de escalamiento y gravedad', () => {
    it('CP-U308 escala con discrepancia o calificación ≤ 2; no escala con 3 sin discrepancia', () => {
      expect(debeEscalar(5, true)).toBe(true);
      expect(debeEscalar(2, false)).toBe(true);
      expect(debeEscalar(1, false)).toBe(true);
      expect(debeEscalar(3, false)).toBe(false);
    });

    it('CP-U309 la gravedad sigue la regla de M06 (1 alta, 2 media, ≥3 baja)', () => {
      expect(gravedadDe(1)).toBe('alta');
      expect(gravedadDe(2)).toBe('media');
      expect(gravedadDe(3)).toBe('baja');
      expect(gravedadDe(5)).toBe('baja');
    });
  });

  describe('registrar (RF-03)', () => {
    it('CP-U310 responde 404 si el lugar no existe y no escribe nada', async () => {
      const { db, query } = crearDb([[]]);
      const error = await capturar(
        new RetroalimentacionService(db).registrar('5', BASE),
      );
      expect(error.getStatus()).toBe(404);
      expect(codigo(error)).toBe('POI_NO_ENCONTRADO');
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('CP-U311 responde 409 si la persona ya calificó el lugar en las últimas 24 h', async () => {
      const { db, query } = crearDb([
        [{ estado: 'verificado' }],
        [{ '?column?': 1 }],
      ]);
      const error = await capturar(
        new RetroalimentacionService(db).registrar('5', BASE),
      );
      expect(error.getStatus()).toBe(409);
      expect(codigo(error)).toBe('RETROALIMENTACION_DUPLICADA');
      expect(query.mock.calls[1][1]).toEqual(['5', '7', 24]);
    });

    it('CP-U312 una buena experiencia sin discrepancia se registra sin abrir incidencia', async () => {
      const { db, query } = crearDb([
        [{ estado: 'verificado' }],
        [],
        [{ id_retroalimentacion: 31 }],
      ]);
      const resultado = await new RetroalimentacionService(db).registrar(
        '5',
        BASE,
      );

      expect(resultado).toEqual({
        id_retroalimentacion: 31,
        id_incidencia: null,
        escalada: false,
        gravedad: null,
      });
      expect(query.mock.calls[2][1]).toEqual([
        '5',
        '7',
        4,
        'Rampa en buen estado',
      ]);
      expect(query).toHaveBeenCalledTimes(3);
    });

    it('CP-U313 una discrepancia abre una incidencia abierta con su tipo y descripción', async () => {
      const { db, query } = crearDb([
        [{ estado: 'verificado' }],
        [],
        [{ id_retroalimentacion: 32 }],
        [{ id_incidencia: 9 }],
      ]);
      const resultado = await new RetroalimentacionService(db).registrar(
        '5',
        DISCREPANCIA,
      );

      expect(resultado).toEqual({
        id_retroalimentacion: 32,
        id_incidencia: 9,
        escalada: true,
        gravedad: 'media',
      });
      expect(query.mock.calls[3][0]).toContain("'abierta'");
      expect(query.mock.calls[3][1]).toEqual([
        32,
        'barrera_nueva',
        'La rampa de la entrada está bloqueada por obras.',
      ]);
    });

    it('CP-U314 una calificación de 1 sin discrepancia abre incidencia de gravedad alta', async () => {
      const { db, query } = crearDb([
        [{ estado: 'verificado' }],
        [],
        [{ id_retroalimentacion: 33 }],
        [{ id_incidencia: 10 }],
      ]);
      const resultado = await new RetroalimentacionService(db).registrar('5', {
        ...BASE,
        calificacion: 1,
        comentario: '',
      });

      expect(resultado.gravedad).toBe('alta');
      expect(query.mock.calls[3][1]).toEqual([
        33,
        TIPO_CALIFICACION_BAJA,
        'Calificación de 1/5 tras la visita.',
      ]);
    });

    it('CP-U315 los datos inválidos se rechazan antes de abrir la transacción', async () => {
      const { db, query } = crearDb([]);
      await capturar(
        Promise.resolve().then(() =>
          new RetroalimentacionService(db).registrar('5', {
            ...BASE,
            calificacion: 9,
          }),
        ),
      );
      expect(query).not.toHaveBeenCalled();
    });

    it('CP-U316 listarMias consulta solo las experiencias de la persona autenticada', async () => {
      const { db, query } = crearDb([[{ id_retroalimentacion: 31 }]]);
      const filas = await new RetroalimentacionService(db).listarMias('5');
      expect(filas).toEqual([{ id_retroalimentacion: 31 }]);
      expect(query.mock.calls[0][1]).toEqual(['5']);
    });
  });
});
