import { API_URL, apiFetch } from './api/client';
import { leerCoordenada } from './coordenadas';
import { CATALOGO_CARACTERISTICAS } from './mocks/catalog';
import type {
  CaracteristicaAccesibilidad,
  EstadoVerificacion,
  ExperienciaViajero,
  IconName,
  Poi,
  TipoValor,
  ValorAccesibilidad,
} from './types';

/**
 * Fuente de datos real del módulo Viajero/Comunidad: `GET /mapa` del
 * backend, que lee la BD OmniTravel en PostgreSQL (AWS RDS) y devuelve las
 * filas de `poi`, `caracteristica_accesibilidad`, `valor_accesibilidad_poi`,
 * `retroalimentacion`, `reporte` y `confirmacion`.
 *
 * Contrato del front intacto (`services/types.ts`): los mapeadores traducen
 * el esquema físico de la BD del equipo al modelo del C4. La app NUNCA
 * muestra lugares inventados: si el backend no responde, `cargarDatosMapa()`
 * devuelve `fuente: 'sin-conexion'`, sin lugares, y una advertencia con la
 * causa para que la persona reintente. Así todo reporte se hace sobre lugares
 * reales de la BD y queda persistido.
 */

/** Origen declarado de los datos tras cada carga. */
export type FuenteDatos = 'backend' | 'sin-conexion';

/** Filas crudas de la BD (mismos nombres de columnas del esquema físico). */
interface FilaPoi {
  id_poi: number;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  direccion: string | null;
  ubicacion: string | { type: string; coordinates: number[] };
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface FilaCaracteristica {
  id_caracteristica: number;
  nombre: string;
  descripcion: string | null;
  tipo_valor: string;
  activa: boolean;
}

interface FilaValor {
  id_valor: number;
  poi_id: number;
  caracteristica_id: number;
  valor_texto: string | null;
  valor_numerico: number | null;
  valor_booleano: boolean | null;
  fecha_actualizacion: string;
}

interface FilaRetroalimentacion {
  id_retroalimentacion: number;
  usuario_id: number | null;
  poi_id: number;
  calificacion: number;
  comentario: string | null;
  fecha: string;
}

interface FilaReporte {
  id_reporte: number;
  poi_id: number;
  tipo: string;
  estado: string;
}

interface FilaConfirmacion {
  id_confirmacion: number;
  reporte_id: number;
  usuario_id: number;
  tipo_confirmacion: string;
}

export interface DatosMapa {
  pois: Poi[];
  catalogo: CaracteristicaAccesibilidad[];
  fuente: FuenteDatos;
  advertencia?: string;
}

/**
 * Mapeo estable del nombre de la BD → id canónico del catálogo del front
 * (mismos tokens que usan los mocks y los filtros U05: `ancho_puerta`,
 * `tiene_rampa`, …). Las características futuras del catálogo sin nombre
 * mapeado reciben un identificador derivado del nombre (slug), manteniendo
 * el catálogo extensible sin tocar formularios ni filtros (doc 04 del MER).
 */
const IDS_ESTABLES: Record<string, string> = {
  'Ancho de puerta': 'ancho_puerta',
  'Tiene rampa': 'tiene_rampa',
  'Tiene ascensor': 'tiene_ascensor',
  'Tiene baño adaptado': 'tiene_bano_accesible',
  'Tiene menú Braille': 'tiene_braille',
  'Tiene piso podotáctil': 'tiene_piso_podotactil',
  'Tiene semáforo sonoro': 'tiene_semaforo_sonoro',
};

/** Iconos canónicos por id estable (misma elección que el catálogo mock). */
const ICONO_POR_ID: Record<string, IconName> = {
  ancho_puerta: 'resize-outline',
  tiene_rampa: 'arrow-up-outline',
  tiene_ascensor: 'swap-vertical-outline',
  tiene_escaleras: 'trending-up-outline',
  tiene_bano_accesible: 'water-outline',
  tiene_semaforo_sonoro: 'volume-high-outline',
  tiene_piso_podotactil: 'footsteps-outline',
  tiene_braille: 'text-outline',
};

const UNIDAD_POR_ID: Record<string, string> = {
  ancho_puerta: 'cm',
};

const CIUDAD_REGION = 'Armenia, Quindío';

/** Convierte un nombre de catálogo en un slug estable (sin acentos/espacios). */
function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

/**
 * Traduce el estado físico de la BD al estado del contrato del C4.
 * El esquema del equipo usa 'publicado'/'pendiente'; el contrato del front
 * define PENDIENTE | EN_REVISION | VERIFICADO. Ambigüedad se degrada a
 * PENDIENTE (prudente salvo si desde la BD existe 'en_revision').
 */
function mapearEstado(estado: string): EstadoVerificacion {
  const normalizado = estado?.trim().toLowerCase();
  if (normalizado === 'publicado' || normalizado === 'verificado') {
    return 'VERIFICADO';
  }
  if (normalizado === 'en_revision') {
    return 'EN_REVISION';
  }
  return 'PENDIENTE';
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Respuesta de `GET /mapa`: filas con los nombres de columna de la BD. */
interface RespuestaMapa {
  caracteristicas: FilaCaracteristica[];
  pois: FilaPoi[];
  valores: FilaValor[];
  retroalimentacion: FilaRetroalimentacion[];
  reportes: FilaReporte[];
  confirmaciones: FilaConfirmacion[];
}

/** Catálogo del equipo traducido a tokens estables del front. */
function obtenerCatalogo(filas: FilaCaracteristica[]): {
  catalogo: CaracteristicaAccesibilidad[];
  idPorNumerico: Map<number, string>;
} {
  const activas = filas.filter((fila) => fila.activa);
  if (activas.length === 0) {
    // BD conectada pero sin catálogo cargado: se muestran las etiquetas del
    // catálogo base (sin `idBd`, así que ningún valor se envía con ids falsos).
    return { catalogo: CATALOGO_CARACTERISTICAS, idPorNumerico: new Map() };
  }

  const idPorNumerico = new Map<number, string>();
  const catalogo = activas.map((fila) => {
    const id = IDS_ESTABLES[fila.nombre] ?? slugDe(fila.nombre);
    idPorNumerico.set(fila.id_caracteristica, id);
    const tipoValor = fila.tipo_valor.toUpperCase() as TipoValor;
    return {
      id,
      nombre: fila.nombre,
      descripcion: fila.descripcion ?? undefined,
      tipoValor,
      unidad: UNIDAD_POR_ID[id],
      icono: ICONO_POR_ID[id] ?? 'accessibility-outline',
      idBd: fila.id_caracteristica,
    };
  });
  return { catalogo, idPorNumerico };
}

/** Compone la lista de POIs del contrato del front a partir de filas BD. */
function mapearPois(
  pois: FilaPoi[],
  valoresPorPoi: Map<number, ValorAccesibilidad[]>,
  retroalimentacion: FilaRetroalimentacion[],
  confirmacionesPorPoi: Map<number, number>,
): Poi[] {
  const retorno = retroalimentacion.reduce<
    Map<number, FilaRetroalimentacion[]>
  >((acumulador, fila) => {
    const lista = acumulador.get(fila.poi_id) ?? [];
    lista.push(fila);
    acumulador.set(fila.poi_id, lista);
    return acumulador;
  }, new Map());

  return pois.flatMap((fila): Poi[] => {
    const coordenada = leerCoordenada(fila.ubicacion);
    if (!coordenada) {
      // POI sin geometría legible se omite del mapa (advertencia del detalle).
      return [];
    }
    const experiencias: FilaRetroalimentacion[] =
      retorno.get(fila.id_poi) ?? [];
    const media =
      experiencias.length > 0
        ? Math.round(
            (experiencias.reduce((suma, x) => suma + x.calificacion, 0) /
              experiencias.length) *
              10,
          ) / 10
        : 0;
    const experienciasPublicas: ExperienciaViajero[] = experiencias.map(
      (x) => ({
        autor: 'Viajero de la comunidad',
        perfil:
          x.calificacion >= 4
            ? 'Experiencia positiva'
            : 'Experiencia con mejoras',
        calificacion: x.calificacion,
        comentario: x.comentario ?? '',
      }),
    );

    const ultimaActualizacion = Math.max(
      new Date(fila.fecha_actualizacion).getTime(),
      new Date(fila.fecha_creacion).getTime(),
    );

    return [
      {
        id: String(fila.id_poi),
        nombre: fila.nombre,
        categoria: capitalizar(fila.tipo),
        descripcion: fila.descripcion ?? '',
        direccion: fila.direccion ?? '',
        ciudad: CIUDAD_REGION,
        latitud: coordenada.latitud,
        longitud: coordenada.longitud,
        calificacion: media,
        totalExperiencias: experiencias.length,
        confirmaciones: confirmacionesPorPoi.get(fila.id_poi) ?? 0,
        estadoVerificacion: mapearEstado(fila.estado),
        ultimaVerificacion: new Date(ultimaActualizacion).toISOString(),
        valores: valoresPorPoi.get(fila.id_poi) ?? [],
        experiencias: experienciasPublicas,
      },
    ];
  });
}

/**
 * Carga los datos del equipo (BD OmniTravel vía backend). Si la lectura
 * falla devuelve `sin-conexion` (sin lugares de demostración) con la causa.
 */
export async function cargarDatosMapa(): Promise<DatosMapa> {
  try {
    const {
      caracteristicas,
      pois: filasPoi,
      valores: filasValor,
      retroalimentacion: filasRetro,
      reportes: filasReporte,
      confirmaciones: filasConfirmacion,
    } = await apiFetch<RespuestaMapa>('/mapa');

    const { catalogo, idPorNumerico } = obtenerCatalogo(caracteristicas);

    const reportePorId = new Map(filasReporte.map((r) => [r.id_reporte, r]));
    const confirmacionesPorPoi = filasConfirmacion.reduce<Map<number, number>>(
      (acumulador, fila) => {
        const reporte = reportePorId.get(fila.reporte_id);
        if (!reporte) {
          return acumulador;
        }
        acumulador.set(
          reporte.poi_id,
          (acumulador.get(reporte.poi_id) ?? 0) + 1,
        );
        return acumulador;
      },
      new Map(),
    );

    const valoresPorPoi = filasValor.reduce<Map<number, ValorAccesibilidad[]>>(
      (acumulador, fila) => {
        const id = idPorNumerico.get(fila.caracteristica_id);
        if (!id) {
          return acumulador;
        }
        const lista = acumulador.get(fila.poi_id) ?? [];
        lista.push({
          caracteristicaId: id,
          valorBooleano: fila.valor_booleano ?? undefined,
          valorNumerico: fila.valor_numerico ?? undefined,
          valorTexto: fila.valor_texto ?? undefined,
        });
        acumulador.set(fila.poi_id, lista);
        return acumulador;
      },
      new Map(),
    );

    return {
      pois: mapearPois(
        filasPoi,
        valoresPorPoi,
        filasRetro,
        confirmacionesPorPoi,
      ),
      catalogo,
      fuente: 'backend',
    };
  } catch (error) {
    const motivo =
      error instanceof Error ? error.message : 'rechazo desconocido';
    return {
      pois: [],
      catalogo: CATALOGO_CARACTERISTICAS,
      fuente: 'sin-conexion',
      advertencia:
        `Sin conexión con el servidor de OmniTravel (${API_URL}). ${motivo} ` +
        'Revisa que el backend esté encendido y en la misma red, y toca Reintentar.',
    };
  }
}
