import { HttpException } from '@nestjs/common';
import {
  ESTADO_PENDIENTE_BD,
  ESTADO_PUBLICADO,
  estadoTrasConfirmaciones,
  validarNuevoReporte,
} from './reportes.reglas';

/**
 * Plan de pruebas — Proceso 1: Validación Colaborativa de Infraestructura.
 * Cada `it` lleva el ID de su caso en TestRail (CP-001 a CP-009).
 */

/** Reporte de un lugar nuevo completo (Museo del Oro Quimbaya, Armenia). */
const reporteCompleto = {
  nombre: 'Museo del Oro Quimbaya',
  lat: 4.5534,
  lon: -75.6586,
};

/** Devuelve el mensaje de dominio del error que lanza la validación. */
function mensajeDeError(datos: Parameters<typeof validarNuevoReporte>[0]): string {
  try {
    validarNuevoReporte(datos);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    return (error as HttpException).getResponse()['message'] as string;
  }
  throw new Error('La validación debía fallar y no falló.');
}

describe('Proceso 1 · Validación de campos obligatorios del reporte', () => {
  it('CP-001 rechaza un lugar nuevo sin nombre', () => {
    expect(mensajeDeError({ ...reporteCompleto, nombre: '   ' })).toMatch(
      /^DATOS_INCOMPLETOS:/,
    );
  });

  it('CP-002 rechaza un lugar nuevo sin ubicación (lat/lon)', () => {
    expect(mensajeDeError({ ...reporteCompleto, lat: null, lon: undefined })).toMatch(
      /^DATOS_INCOMPLETOS:/,
    );
  });

  it('CP-003 acepta un reporte completo', () => {
    expect(() => validarNuevoReporte(reporteCompleto)).not.toThrow();
  });
});

describe('Proceso 1 · Validación de coordenadas lat/lng válidas', () => {
  it('CP-004 acepta coordenadas válidas, incluidos los límites del rango', () => {
    expect(() => validarNuevoReporte(reporteCompleto)).not.toThrow();
    expect(() =>
      validarNuevoReporte({ ...reporteCompleto, lat: -90, lon: 180 }),
    ).not.toThrow();
  });

  it('CP-005 rechaza latitud fuera de rango (> 90 o < -90)', () => {
    expect(mensajeDeError({ ...reporteCompleto, lat: 90.0001 })).toMatch(/fuera de rango/);
    expect(mensajeDeError({ ...reporteCompleto, lat: -91 })).toMatch(/fuera de rango/);
  });

  it('CP-006 rechaza longitud fuera de rango (> 180 o < -180)', () => {
    expect(mensajeDeError({ ...reporteCompleto, lon: 180.5 })).toMatch(/fuera de rango/);
    expect(mensajeDeError({ ...reporteCompleto, lon: -200 })).toMatch(/fuera de rango/);
  });
});

describe('Proceso 1 · Lógica de quórum de 3 confirmaciones', () => {
  it('CP-007 con 1 confirmación el reporte sigue pendiente_validacion', () => {
    expect(estadoTrasConfirmaciones(1, ESTADO_PENDIENTE_BD)).toBe(ESTADO_PENDIENTE_BD);
  });

  it('CP-008 con 2 confirmaciones el reporte sigue pendiente_validacion', () => {
    expect(estadoTrasConfirmaciones(2, ESTADO_PENDIENTE_BD)).toBe(ESTADO_PENDIENTE_BD);
  });

  it('CP-009 con 3 confirmaciones el reporte pasa a publicado', () => {
    expect(estadoTrasConfirmaciones(3, ESTADO_PENDIENTE_BD)).toBe(ESTADO_PUBLICADO);
  });
});
