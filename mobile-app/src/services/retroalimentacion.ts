import { ApiError, apiFetch } from './api/client';
import type { CuerpoRetroalimentacion } from '../utils/retroalimentacion';

/**
 * Proceso 3 — Retroalimentación post-viaje (U13).
 *   POST /retroalimentacion · GET /retroalimentacion/mias
 * El backend registra la experiencia y, si hay discrepancia o la calificación
 * es ≤ 2, abre una incidencia que moderación atiende en M06.
 */

export interface ResultadoRetroalimentacion {
  id: string;
  incidenciaId: string | null;
  escalada: boolean;
  gravedad: 'alta' | 'media' | 'baja' | null;
}

interface RespuestaCruda {
  id_retroalimentacion: number;
  id_incidencia: number | null;
  escalada: boolean;
  gravedad: 'alta' | 'media' | 'baja' | null;
}

/** Mensajes para los códigos que devuelve el backend (`'CODIGO: mensaje'`). */
const MENSAJES: Record<string, string> = {
  RETROALIMENTACION_DUPLICADA:
    'Ya calificaste este lugar en las últimas 24 horas. ¡Gracias por tu aporte!',
  POI_NO_ENCONTRADO: 'El lugar ya no está disponible.',
  CALIFICACION_INVALIDA: 'Elige de 1 a 5 estrellas.',
  DESCRIPCION_REQUERIDA: 'Describe la discrepancia con al menos 10 caracteres.',
  TIPO_DISCREPANCIA_INVALIDO: 'Elige qué no coincidía con la información.',
  COMENTARIO_MUY_LARGO: 'El comentario admite máximo 500 caracteres.',
  DATOS_INCOMPLETOS: 'Falta indicar el lugar que visitaste.',
};

export class RetroalimentacionError extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'RetroalimentacionError';
    this.codigo = codigo;
  }
}

/** Traduce el error del backend a un mensaje claro para la persona. */
export function mapearErrorRetro(error: unknown): RetroalimentacionError {
  const texto = error instanceof Error ? error.message : String(error ?? '');
  const separador = texto.indexOf(':');
  const codigo = (separador > 0 ? texto.slice(0, separador) : '').trim();
  if (codigo in MENSAJES) {
    return new RetroalimentacionError(codigo, MENSAJES[codigo]);
  }
  if (error instanceof ApiError && error.status === 401) {
    return new RetroalimentacionError('SESION', error.message);
  }
  return new RetroalimentacionError(
    'DESCONOCIDO',
    'No pudimos enviar tu experiencia. Revisa tu conexión e inténtalo de nuevo.',
  );
}

export async function enviarRetroalimentacion(
  cuerpo: CuerpoRetroalimentacion,
): Promise<ResultadoRetroalimentacion> {
  try {
    const respuesta = await apiFetch<RespuestaCruda>('/retroalimentacion', {
      method: 'POST',
      body: JSON.stringify(cuerpo),
    });
    return {
      id: String(respuesta.id_retroalimentacion),
      incidenciaId:
        respuesta.id_incidencia == null
          ? null
          : String(respuesta.id_incidencia),
      escalada: respuesta.escalada === true,
      gravedad: respuesta.gravedad ?? null,
    };
  } catch (error) {
    throw mapearErrorRetro(error);
  }
}
