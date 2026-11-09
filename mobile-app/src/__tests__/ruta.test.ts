import {
  datosDesactualizados,
  iconoDeManeuver,
  normalizarRespuestaRuta,
  restriccionesDesdePerfil,
} from '../utils/ruta';

/** Codificador polyline6 mínimo para pruebas (inverso del decodificador). */
function codificar(coordenadas: [number, number][], precision = 6): string {
  const factor = 10 ** precision;
  let latPrevia = 0;
  let lonPrevia = 0;
  let salida = '';

  for (const [latitud, longitud] of coordenadas) {
    const latInt = Math.round(latitud * factor);
    const lonInt = Math.round(longitud * factor);

    for (const valor of [latInt - latPrevia, lonInt - lonPrevia]) {
      let resto = valor < 0 ? ~(valor << 1) : valor << 1;
      while (resto >= 0x20) {
        salida += String.fromCharCode((0x20 | (resto & 0x1f)) + 63);
        resto >>= 5;
      }
      salida += String.fromCharCode(resto + 63);
    }

    latPrevia = latInt;
    lonPrevia = lonInt;
  }

  return salida;
}

describe('restriccionesDesdePerfil', () => {
  it('deriva el perfil motriz con evitar escaleras y favorecer ascensores', () => {
    expect(restriccionesDesdePerfil(['silla_de_ruedas'])).toEqual({
      perfil: 'silla_de_ruedas',
      avoidStairs: true,
      requireElevator: true,
    });
    expect(restriccionesDesdePerfil(['movilidad_reducida'])).toEqual({
      perfil: 'silla_de_ruedas',
      avoidStairs: true,
      requireElevator: true,
    });
  });

  it('deriva el perfil visual con preferencia por semáforos sonoros', () => {
    expect(restriccionesDesdePerfil(['visual'])).toEqual({
      perfil: 'visual',
      preferSoundTrafficLights: true,
    });
  });

  it('prioriza el perfil motriz cuando conviven necesidades (tipos exclusivos en Valhalla)', () => {
    expect(restriccionesDesdePerfil(['visual', 'silla_de_ruedas'])).toEqual({
      perfil: 'silla_de_ruedas',
      avoidStairs: true,
      requireElevator: true,
    });
  });

  it('sin necesidades declaradas usa los filtros activos como preferencias', () => {
    expect(
      restriccionesDesdePerfil([], ['sin_escalones', 'ascensor_amplio']),
    ).toEqual({ avoidStairs: true, requireElevator: true });
    expect(restriccionesDesdePerfil([], ['semaforos_sonoros'])).toEqual({
      preferSoundTrafficLights: true,
    });
  });

  it('sin necesidades ni filtros no impone restricciones', () => {
    expect(restriccionesDesdePerfil([], [])).toEqual({});
  });
});

describe('iconoDeManeuver', () => {
  it('mapea los tipos de maniobra relevantes del peatón', () => {
    expect(iconoDeManeuver(1)).toBe('navigate-circle-outline');
    expect(iconoDeManeuver(4)).toBe('flag-outline');
    expect(iconoDeManeuver(9)).toBe('return-up-forward-outline');
    expect(iconoDeManeuver(10)).toBe('arrow-forward-circle-outline');
    expect(iconoDeManeuver(15)).toBe('arrow-back-circle-outline');
    expect(iconoDeManeuver(26)).toBe('sync-circle-outline');
    expect(iconoDeManeuver(40)).toBe('trending-up-outline');
  });

  it('usa un ícono neutro para tipos desconocidos', () => {
    expect(iconoDeManeuver(99)).toBe('ellipse-outline');
  });
});

describe('datosDesactualizados', () => {
  // Reloj fijo: sin él, entre calcular la fecha y evaluarla pasan unos
  // milisegundos y el caso límite (60 días exactos) fallaba de forma aleatoria.
  const AHORA = Date.UTC(2026, 10, 9, 12, 0, 0);
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(AHORA));
  afterEach(() => jest.restoreAllMocks());
  const haceDias = (dias: number) =>
    new Date(AHORA - dias * 24 * 60 * 60 * 1000).toISOString();

  it('considera vigentes los datos recientes (≤ 60 días)', () => {
    expect(datosDesactualizados(haceDias(10))).toBe(false);
    expect(datosDesactualizados(haceDias(60))).toBe(false);
  });

  it('marca como desactualizados los datos con más de 60 días', () => {
    expect(datosDesactualizados(haceDias(61))).toBe(true);
  });

  it('trata fechas ausentes o inválidas como no confiables', () => {
    expect(datosDesactualizados(undefined)).toBe(true);
    expect(datosDesactualizados(null)).toBe(true);
    expect(datosDesactualizados('fecha-invalida')).toBe(true);
  });
});

describe('normalizarRespuestaRuta', () => {
  const shape = codificar([
    [4.537, -75.675],
    [4.535, -75.678],
  ]);

  it('normaliza el contrato propio de OmniTravel (backend actualizado)', () => {
    const ruta = normalizarRespuestaRuta({
      distanciaKm: 1.25,
      duracionMin: 16.4,
      perfil: 'silla_de_ruedas',
      shape,
      pasos: [
        { tipo: 1, instruccion: 'Camina hacia el norte.', distanciaKm: 0.2 },
        { tipo: 10, instruccion: 'Gira a la derecha.', distanciaKm: 1.05 },
      ],
      advertencias: ['La ruta puede incluir escaleras.', 42, ''],
    });

    expect(ruta.distanciaKm).toBe(1.25);
    expect(ruta.duracionMin).toBe(16.4);
    expect(ruta.perfil).toBe('silla_de_ruedas');
    expect(ruta.pasos).toHaveLength(2);
    expect(ruta.pasos?.[1]).toEqual({
      tipo: 10,
      instruccion: 'Gira a la derecha.',
      distanciaKm: 1.05,
    });
    expect(ruta.advertencias).toEqual(['La ruta puede incluir escaleras.']);
    expect(ruta.coordenadas).toHaveLength(2);
    expect(ruta.coordenadas?.[0].latitude).toBeCloseTo(4.537, 5);
    expect(ruta.coordenadas?.[1].longitude).toBeCloseTo(-75.678, 5);
  });

  it('omite pasos sin instrucción legible', () => {
    const ruta = normalizarRespuestaRuta({
      distanciaKm: 0.5,
      duracionMin: 6,
      pasos: [
        { tipo: 8, instruccion: '', distanciaKm: 0.5 },
        { tipo: 4, instruccion: 'Has llegado.', distanciaKm: 0 },
      ],
    });
    expect(ruta.pasos).toEqual([
      { tipo: 4, instruccion: 'Has llegado.', distanciaKm: 0 },
    ]);
  });

  it('normaliza el formato crudo de Valhalla (compatibilidad de despliegue)', () => {
    const ruta = normalizarRespuestaRuta({
      trip: {
        summary: { length: 2.5, time: 900 },
        legs: [
          {
            shape,
            maneuvers: [
              { type: 1, instruction: 'Camina hacia el norte.', length: 0.4 },
              { type: 15, instruction: 'Gira a la izquierda.', length: 2.1 },
            ],
          },
        ],
      },
      warnings: ['Aviso del motor.'],
    });

    expect(ruta.distanciaKm).toBe(2.5);
    expect(ruta.duracionMin).toBe(15);
    expect(ruta.perfil).toBeUndefined();
    expect(ruta.pasos).toHaveLength(2);
    expect(ruta.advertencias).toEqual(['Aviso del motor.']);
    expect(ruta.coordenadas).toHaveLength(2);
  });

  it('falla con un error claro cuando la respuesta no es normalizable', () => {
    expect(() => normalizarRespuestaRuta({})).toThrow(
      'El motor de ruteo devolvió una respuesta inesperada.',
    );
    expect(() =>
      normalizarRespuestaRuta({ trip: { summary: { length: 1 } } }),
    ).toThrow('El motor de ruteo devolvió una respuesta inesperada.');
  });

  it('adjunta la ruta alternativa del formato crudo de Valhalla (alternates)', () => {
    const ruta = normalizarRespuestaRuta({
      trip: {
        summary: { length: 2.5, time: 900 },
        legs: [
          {
            shape,
            maneuvers: [
              { type: 1, instruction: 'Camina al norte.', length: 2.5 },
            ],
          },
        ],
      },
      warnings: [],
      alternates: [
        {
          trip: {
            summary: { length: 3.1, time: 1500 },
            legs: [
              {
                shape: codificar([
                  [4.537, -75.675],
                  [4.54, -75.69],
                ]),
                maneuvers: [
                  {
                    type: 15,
                    instruction: 'Gira a la izquierda.',
                    length: 3.1,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(ruta.alternativa).toBeDefined();
    expect(ruta.alternativa?.distanciaKm).toBe(3.1);
    expect(ruta.alternativa?.duracionMin).toBe(25);
    expect(ruta.alternativa?.pasos).toEqual([
      { tipo: 15, instruccion: 'Gira a la izquierda.', distanciaKm: 3.1 },
    ]);
    expect(ruta.alternativa?.advertencias).toEqual([]);
    // Distinta geometría base: el recálculo muestra un camino diferente.
    expect(ruta.coordenadas?.[0].latitude).toBeCloseTo(4.537, 5);
    expect(ruta.alternativa?.coordenadas?.[1].longitude).toBeCloseTo(-75.69, 5);
  });

  it('adjunta la alternativa del contrato backend (ya normalizada)', () => {
    const ruta = normalizarRespuestaRuta({
      distanciaKm: 1.25,
      duracionMin: 16.4,
      perfil: 'silla_de_ruedas',
      shape,
      pasos: [{ tipo: 1, instruccion: 'Camina al norte.', distanciaKm: 1.25 }],
      advertencias: ['Aviso del backend.'],
      alternativa: {
        distanciaKm: 1.8,
        duracionMin: 24.2,
        perfil: 'silla_de_ruedas',
        shape,
        pasos: [
          {
            tipo: 8,
            instruccion: 'Continúa por la avenida.',
            distanciaKm: 1.8,
          },
        ],
        advertencias: [],
      },
    });

    expect(ruta.alternativa?.distanciaKm).toBe(1.8);
    expect(ruta.alternativa?.duracionMin).toBe(24.2);
    expect(ruta.alternativa?.perfil).toBe('silla_de_ruedas');
    expect(ruta.alternativa?.pasos).toHaveLength(1);
  });

  it('omite alternativas malformadas sin romper la ruta principal', () => {
    const ruta = normalizarRespuestaRuta({
      trip: {
        summary: { length: 2.5, time: 900 },
        legs: [],
      },
      alternates: [
        'basura',
        null,
        { summary: {} },
        { trip: { summary: { time: 900 } } },
      ],
    });
    expect(ruta.alternativa).toBeUndefined();
    expect(ruta.distanciaKm).toBe(2.5);
  });
});
