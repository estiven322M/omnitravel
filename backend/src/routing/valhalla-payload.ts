import {
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';

/**
 * Contrato de ruteo accesible del Proceso 2 (backend ↔ Valhalla).
 *
 * Decisiones de diseño (verificadas contra la documentación oficial de
 * Valhalla, sección "Pedestrian costing options"):
 *
 * - Valhalla no tiene un costing `wheelchair` propio: el perfil de silla de
 *   ruedas es `costing: 'pedestrian'` + `costing_options.pedestrian.type:
 *   'wheelchair'`, que ajusta `max_distance`, `walking_speed` y
 *   `step_penalty` a las necesidades de una persona usuaria de silla.
 * - El perfil visual usa `type: 'blind'`, que amplía la narración (cruces,
 *   escaleras, puentes, semáforos en pasos peatonales). Ambos tipos son
 *   mutuamente exclusivos; la prioridad es motriz.
 * - `avoidStairs` se expresa con una penalización alta (1 h) por cada tramo
 *   de escaleras: la ruta las evita salvo que no exista alternativa, en
 *   cuyo caso sigue siendo navegable (no se bloquea al usuario).
 * - `requireElevator` baja la penalización de ascensores a 0 s (dejan de
 *   evitarse). `preferSoundTrafficLights` no tiene opción de costo propia en
 *   Valhalla: se cubre con la narración del perfil visual y, si llega sin ese
 *   perfil, se devuelve una advertencia para no prometer algo que el motor
 *   no aplica.
 */

export type PerfilRuta = 'peatonal' | 'silla_de_ruedas' | 'visual';

export interface RestriccionesRuta {
    /** Perfil de accesibilidad derivado de las necesidades de la persona. */
    perfil?: PerfilRuta;
    /** Evitar escaleras (perfil motriz). */
    avoidStairs?: boolean;
    /** Favorecer trayectos con ascensor (perfil motriz). */
    requireElevator?: boolean;
    /** Preferir semáforos sonoros (perfil visual). */
    preferSoundTrafficLights?: boolean;
}

export type Coordenada = [number, number];

export interface PasoRutaNormalizado {
    /** Tipo de maniobra Valhalla (kStart = 1 … kBuildingExit = 43). */
    tipo: number;
    /** Instrucción de navegación ya localizada (es-ES). */
    instruccion: string;
    /** Longitud del tramo en kilómetros. */
    distanciaKm: number;
}

/** Respuesta normalizada que consume la app (aislada del formato Valhalla). */
export interface RutaNormalizada {
    distanciaKm: number;
    duracionMin: number;
    perfil: PerfilRuta;
    /** Geometría codificada polyline6 (la decodifica el cliente). */
    shape?: string;
    pasos: PasoRutaNormalizado[];
    advertencias: string[];
    /**
     * Camino alternativo que el motor propuso para el mismo par origen/destino
     * (Valhalla `alternates`): la app lo muestra con "Recalcular ruta" para no
     * repetir el mismo trayecto.
     */
    alternativa?: RutaNormalizada;
}

interface SolicitudValhalla {
    locations: { lat: number; lon: number }[];
    costing: 'pedestrian';
    costing_options: { pedestrian: Record<string, string | number> };
    units: 'kilometers';
    language: 'es-ES';
    /**
     * `alternates: 1` → hasta 2 rutas (principal + alternativa). El uso es
     * exactamente 2 locations, condición necesaria para alternates en
     * Valhalla (no puede haber mejores alternativas en rutas multipunto).
     */
    alternates: 1;
    /**
     * Puntos de la ruta anterior que la nueva debe evitar («Cambiar ruta»).
     * Valhalla excluye las vías más cercanas a cada punto.
     */
    exclude_locations?: { lat: number; lon: number }[];
}

/** Máximo de puntos a evitar por solicitud (protege al motor de ruteo). */
export const MAX_PUNTOS_EVITAR = 8;

/** Valida que una coordenada del body sea [latitud, longitud] finita y en rango. */
export function validarCoordenada(valor: unknown, campo: string): Coordenada {
    if (
        !Array.isArray(valor) ||
        valor.length !== 2 ||
        valor.some((numero) => typeof numero !== 'number' || !Number.isFinite(numero))
    ) {
        throw new BadRequestException(`${campo} debe ser [latitud, longitud].`);
    }

    const [lat, lon] = valor as Coordenada;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new BadRequestException(`${campo} está fuera de rango geográfico.`);
    }

    return [lat, lon];
}

/** Valida la lista opcional de puntos a evitar: [[lat, lon], …] (máx. 8). */
export function validarPuntosEvitar(valor: unknown): Coordenada[] {
    if (valor === undefined || valor === null) {
        return [];
    }
    if (!Array.isArray(valor) || valor.length > MAX_PUNTOS_EVITAR) {
        throw new BadRequestException(
            `avoid debe ser una lista de hasta ${MAX_PUNTOS_EVITAR} coordenadas [latitud, longitud].`,
        );
    }
    return valor.map((punto, indice) => validarCoordenada(punto, `avoid[${indice}]`));
}

/** Construye la solicitud de ruteo peatonal para Valhalla. */
export function construirSolicitudValhalla(
    origen: Coordenada,
    destino: Coordenada,
    restricciones: RestriccionesRuta = {},
    evitar: Coordenada[] = [],
): { solicitud: SolicitudValhalla; advertencias: string[] } {
    const opcionesPedestrian: Record<string, string | number> = {};
    const advertencias: string[] = [];

    if (restricciones.perfil === 'silla_de_ruedas') {
        opcionesPedestrian.type = 'wheelchair';
    } else if (restricciones.perfil === 'visual') {
        opcionesPedestrian.type = 'blind';
    }

    if (restricciones.avoidStairs) {
        opcionesPedestrian.step_penalty = 3600;
    }

    if (restricciones.requireElevator) {
        opcionesPedestrian.elevator_penalty = 0;
    }

    if (
        restricciones.preferSoundTrafficLights &&
        restricciones.perfil !== 'visual'
    ) {
        advertencias.push(
            'La preferencia por semáforos sonoros se aplica con el perfil visual (narración asistida de cruces).',
        );
    }

    return {
        solicitud: {
            locations: [
                { lat: origen[0], lon: origen[1] },
                { lat: destino[0], lon: destino[1] },
            ],
            costing: 'pedestrian',
            costing_options: { pedestrian: opcionesPedestrian },
            units: 'kilometers',
            language: 'es-ES',
            alternates: 1,
            ...(evitar.length > 0
                ? { exclude_locations: evitar.map(([lat, lon]) => ({ lat, lon })) }
                : {}),
        },
        advertencias,
    };
}

/** Normaliza `trip.summary` + `trip.legs` de Valhalla (o una ruta alternativa). */
function normalizarTripValhalla(
    trip: unknown,
    perfil: PerfilRuta,
    advertencias: string[],
): RutaNormalizada {
    const legibles = trip as {
        summary?: { length?: unknown; time?: unknown };
        legs?: {
            shape?: string;
            maneuvers?: { type?: number; instruction?: string; length?: number }[];
        }[];
    };

    const longitud = legibles?.summary?.length;
    const tiempo = legibles?.summary?.time;
    if (typeof longitud !== 'number' || typeof tiempo !== 'number') {
        throw new InternalServerErrorException(
            'El motor de ruteo devolvió una respuesta inesperada.',
        );
    }

    const pasos: PasoRutaNormalizado[] = (legibles.legs ?? []).flatMap(
        (tramo) =>
            (tramo.maneuvers ?? []).map((maniobra) => ({
                tipo: maniobra.type ?? 0,
                instruccion: maniobra.instruction ?? '',
                distanciaKm: maniobra.length ?? 0,
            })),
    );

    return {
        distanciaKm: longitud,
        duracionMin: Math.round((tiempo / 60) * 10) / 10,
        perfil,
        shape: legibles.legs?.[0]?.shape,
        pasos,
        advertencias: [...advertencias],
    };
}

/**
 * Normaliza la respuesta cruda de Valhalla al contrato del front:
 * resumen, pasos (maneuvers) y advertencias del motor. Si el motor incluyó
 * una ruta alternativa (Valhalla `alternates`), la adjunta en `alternativa`.
 */
export function normalizarRespuestaValhalla(
    crudo: unknown,
    perfil: PerfilRuta,
    advertenciasExtra: string[] = [],
): RutaNormalizada {
    const datos = crudo as {
        trip?: unknown;
        /** Rutas alternativas: cada entrada envuelve su propio `trip`. */
        alternates?: unknown[];
        warnings?: unknown;
    };

    const avisosMotor = Array.isArray(datos.warnings)
        ? datos.warnings.filter(
            (aviso): aviso is string => typeof aviso === 'string',
        )
        : [];

    const ruta = normalizarTripValhalla(
        datos.trip,
        perfil,
        [...avisosMotor, ...advertenciasExtra],
    );

    // Alternativa válida: la primera entrada de `alternates` cuyo `trip`
    // tenga un resumen numérico (las inválidas se omiten, no rompen la ruta).
    const citaAlternativa = (datos.alternates ?? [])
        .map((entrada) =>
            entrada && typeof entrada === 'object'
                ? (entrada as { trip?: unknown }).trip ?? entrada
                : undefined,
        )
        .find((elemento) =>
            typeof elemento === 'object' &&
            typeof (elemento as { summary?: { length?: unknown } }).summary
                ?.length === 'number',
        );

    if (citaAlternativa) {
        try {
            ruta.alternativa = normalizarTripValhalla(citaAlternativa, perfil, []);
        } catch {
            // Alternativa malformada: se entrega la ruta principal intacta.
        }
    }

    return ruta;
}
