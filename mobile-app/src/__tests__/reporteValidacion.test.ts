import type { CaracteristicaAccesibilidad } from '../services/types';
import {
  alternarEtiquetaRapida,
  BORRADOR_INICIAL,
  errorDeCampo,
  MENSAJES_VALIDACION,
  construirCaracteristicas,
  contarValoresRespondidos,
  estaEtiquetaElegida,
  ETIQUETAS_RAPIDAS,
  validarPaso1,
  validarPaso2,
  validarPasoDetalles,
  validarPasoUbicacion,
  type BorradorReporte,
  type EtiquetaRapida,
  type ValorBorrador,
} from '../utils/reporteValidacion';

const CATALOGO: CaracteristicaAccesibilidad[] = [
  {
    id: 'ancho_puerta',
    nombre: 'Ancho de puerta',
    tipoValor: 'NUMERICO',
    unidad: 'cm',
    icono: 'resize-outline',
    idBd: 1,
  },
  {
    id: 'tiene_rampa',
    nombre: 'Rampa',
    tipoValor: 'BOOLEANO',
    icono: 'arrow-up-outline',
    idBd: 2,
  },
  {
    id: 'nota_extra',
    nombre: 'Nota',
    tipoValor: 'TEXTO',
    icono: 'text-outline',
    idBd: 3,
  },
  {
    id: 'sin_id_fisico',
    nombre: 'Sin id (mock)',
    tipoValor: 'BOOLEANO',
    icono: 'text-outline',
  },
];

function borrador(parcial: Partial<BorradorReporte>): BorradorReporte {
  return { ...BORRADOR_INICIAL, ...parcial };
}

describe('validarPaso1', () => {
  it('exige nombre y tipo para un lugar nuevo', () => {
    const errores = validarPaso1(borrador({ modo: 'nuevo' }));
    expect(errores).toHaveLength(2);
  });

  it('acepta un lugar nuevo completo', () => {
    const errores = validarPaso1(
      borrador({ modo: 'nuevo', nombre: 'Centro Cultural', tipoPoi: 'museo' }),
    );
    expect(errores).toEqual([]);
  });

  it('exige seleccionar un lugar al actualizar', () => {
    expect(validarPaso1(borrador({ modo: 'actualizacion' }))).toHaveLength(1);
    expect(
      validarPaso1(borrador({ modo: 'actualizacion', poiId: '5' })),
    ).toEqual([]);
  });
});

describe('validarPaso2', () => {
  it('exige GPS y descripción para un lugar nuevo', () => {
    const errores = validarPaso2(borrador({ modo: 'nuevo' }));
    expect(errores).toHaveLength(2);
  });

  it('acepta un lugar nuevo con coordenadas y descripción', () => {
    const errores = validarPaso2(
      borrador({
        modo: 'nuevo',
        lat: 4.53389,
        lon: -75.68111,
        descripcion: 'La entrada tiene rampa',
      }),
    );
    expect(errores).toEqual([]);
  });

  it('no exige coordenadas al actualizar un lugar existente', () => {
    const errores = validarPaso2(
      borrador({
        modo: 'actualizacion',
        poiId: '5',
        descripcion: 'Corrijo el ancho de puerta',
      }),
    );
    expect(errores).toEqual([]);
  });
});

describe('construirCaracteristicas', () => {
  it('convierte booleanos, numéricos (con coma o punto) y texto', () => {
    const valores = construirCaracteristicas(CATALOGO, {
      tiene_rampa: { booleano: false },
      ancho_puerta: { numerico: '90,5' },
      nota_extra: { texto: '  Entrada lateral  ' },
    });

    expect(valores).toEqual([
      { caracteristicaId: 1, valorNumerico: 90.5 },
      { caracteristicaId: 2, valorBooleano: false },
      { caracteristicaId: 3, valorTexto: 'Entrada lateral' },
    ]);
  });

  it('omite valores vacíos, inválidos y sin id físico', () => {
    const valores = construirCaracteristicas(CATALOGO, {
      ancho_puerta: { numerico: 'abc' },
      nota_extra: { texto: '   ' },
      sin_id_fisico: { booleano: true },
    });

    expect(valores).toEqual([]);
  });

  it('incluye el valor booleano false (negar también es información)', () => {
    const valores = construirCaracteristicas(CATALOGO, {
      tiene_rampa: { booleano: false },
    });
    expect(valores).toEqual([{ caracteristicaId: 2, valorBooleano: false }]);
  });
});

describe('contarValoresRespondidos', () => {
  it('cuenta solo los valores con contenido', () => {
    expect(
      contarValoresRespondidos({
        tiene_rampa: { booleano: true },
        ancho_puerta: { numerico: '' },
        nota_extra: { texto: 'ok' },
      }),
    ).toBe(2);
  });
});

describe('validarPasoUbicacion (paso 2 del wizard reorganizado)', () => {
  it('combina identificación y ubicación', () => {
    // Lugar nuevo sin nombre/tipo ni GPS: 2 de identificación + 1 de ubicación.
    expect(validarPasoUbicacion(borrador({ modo: 'nuevo' }))).toHaveLength(3);
  });

  it('pasa con datos completos de lugar nuevo', () => {
    const errores = validarPasoUbicacion(
      borrador({
        modo: 'nuevo',
        nombre: 'Museo',
        tipoPoi: 'museo',
        lat: 4.53389,
        lon: -75.68111,
      }),
    );
    expect(errores).toEqual([]);
  });

  it('no exige GPS al actualizar un lugar elegido', () => {
    const errores = validarPasoUbicacion(
      borrador({ modo: 'actualizacion', poiId: '5' }),
    );
    expect(errores).toEqual([]);
  });
});

describe('validarPasoDetalles (paso 3 del wizard reorganizado)', () => {
  it('exige descripción', () => {
    expect(validarPasoDetalles(borrador({}))).toHaveLength(1);
    expect(
      validarPasoDetalles(borrador({ descripcion: 'La rampa es nueva' })),
    ).toEqual([]);
  });
});

describe('etiquetas rápidas', () => {
  it('identifica una etiqueta elegida, también con valor false', () => {
    const valores = { tiene_rampa: { booleano: false } };
    const sinRampa = ETIQUETAS_RAPIDAS.find(
      (etiqueta) => etiqueta.id === 'sin_rampa',
    );
    expect(sinRampa).toBeDefined();
    expect(estaEtiquetaElegida(valores, sinRampa!)).toBe(true);
  });

  it('no confunde la etiqueta opuesta sobre la misma característica', () => {
    const valores = { tiene_rampa: { booleano: false } };
    const sinRampa = porId('sin_rampa');
    const rampaBien = porId('rampa_bien');
    expect(estaEtiquetaElegida(valores, sinRampa)).toBe(true);
    expect(estaEtiquetaElegida(valores, rampaBien)).toBe(false);
  });

  it('activa y retira una etiqueta sin mutar el registro original', () => {
    const valoresBase: Record<string, ValorBorrador> = {};

    const conRampa = alternarEtiquetaRapida(valoresBase, porId('rampa_bien'));
    expect(conRampa.tiene_rampa).toEqual({ booleano: true });
    expect(valoresBase).toEqual({});

    const sinRampaActiva = alternarEtiquetaRapida(conRampa, porId('sin_rampa'));
    // La etiqueta opuesta reemplaza al valor anterior de la característica.
    expect(sinRampaActiva.tiene_rampa).toEqual({ booleano: false });

    const limpio = alternarEtiquetaRapida(sinRampaActiva, porId('sin_rampa'));
    expect(limpio.tiene_rampa).toBeUndefined();
  });

  it('la etiqueta numérica fija el ancho como texto y se retira igual', () => {
    const conPuertaEstrecha = alternarEtiquetaRapida(
      {},
      porId('puerta_estrecha'),
    );
    expect(conPuertaEstrecha.ancho_puerta).toEqual({ numerico: '75' });
    expect(
      estaEtiquetaElegida(conPuertaEstrecha, porId('puerta_estrecha')),
    ).toBe(true);

    const limpio = alternarEtiquetaRapida(
      conPuertaEstrecha,
      porId('puerta_estrecha'),
    );
    expect(limpio.ancho_puerta).toBeUndefined();
  });
});

/** Busca una etiqueta rápida por su id estable. */
function porId(id: string): EtiquetaRapida {
  const etiqueta = ETIQUETAS_RAPIDAS.find((item) => item.id === id);
  if (!etiqueta) {
    throw new Error(`No existe la etiqueta ${id} en ETIQUETAS_RAPIDAS`);
  }
  return etiqueta;
}

describe('errorDeCampo (errores junto a cada campo, auditoría 6.8)', () => {
  it('ubica cada error del paso en su campo', () => {
    const errores = validarPasoUbicacion(
      borrador({
        modo: 'nuevo',
        nombre: '',
        tipoPoi: '',
        lat: null,
        lon: null,
      }),
    );
    expect(errorDeCampo(errores, 'nombre')).toBe(MENSAJES_VALIDACION.nombre);
    expect(errorDeCampo(errores, 'tipo')).toBe(MENSAJES_VALIDACION.tipo);
    expect(errorDeCampo(errores, 'ubicacion')).toBe(
      MENSAJES_VALIDACION.ubicacion,
    );
    expect(errorDeCampo(errores, 'descripcion')).toBeUndefined();
  });

  it('no marca campos cuando el paso está completo', () => {
    const errores = validarPasoUbicacion(
      borrador({
        modo: 'nuevo',
        nombre: 'Parque Sucre',
        tipoPoi: 'parque',
        lat: 4.53,
        lon: -75.67,
      }),
    );
    expect(errores).toEqual([]);
    expect(errorDeCampo(errores, 'nombre')).toBeUndefined();
  });
});
