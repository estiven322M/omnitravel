import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { consultarValhalla } from './valhalla-cliente';
import {
    construirSolicitudValhalla,
    MAX_PUNTOS_EVITAR,
    normalizarRespuestaValhalla,
    validarCoordenada,
    validarPuntosEvitar,
    type Coordenada,
    type RestriccionesRuta,
    type RutaNormalizada,
} from './valhalla-payload';

/** Margen (grados ≈ 1,1 km) alrededor del trayecto para buscar barreras. */
const MARGEN_BARRERAS_GRADOS = 0.01;
/** Una barrera pegada al origen o al destino no se puede evitar. */
const RADIO_EXTREMOS_M = 40;

export const AVISO_BARRERAS_EVITADAS = (n: number) =>
    n === 1
        ? 'Esta ruta evita 1 barrera crítica reportada por la comunidad.'
        : `Esta ruta evita ${n} barreras críticas reportadas por la comunidad.`;
export const AVISO_BARRERAS_NO_EVITABLES =
    'No existe un camino que evite todas las barreras críticas reportadas: te avisaremos al acercarte a ellas durante la navegación.';

/**
 * Proceso 2 — Motor de rutas accesibles.
 *
 * Traduce la petición de la app (`POST /routes`) a una solicitud peatonal de
 * Valhalla con las restricciones de accesibilidad del perfil y normaliza la
 * respuesta (distancia, duración, pasos y advertencias). El detalle del
 * contrato vive en `valhalla-payload.ts`.
 *
 * RT1 / RNF-26: las barreras críticas vigentes (reportes `es_critico` no
 * rechazados) cercanas al trayecto se excluyen del cálculo. Si no hay camino
 * que las evite, se calcula sin ellas y se advierte a la persona.
 */
@Injectable()
export class RoutingService {
    private readonly logger = new Logger(RoutingService.name);
    private readonly valhallaUrl =
        process.env.VALHALLA_URL ?? 'http://localhost:8002';

    constructor(
        @Optional() @InjectDataSource() private readonly db?: DataSource,
    ) { }

    async calculateRoute(
        origin: unknown,
        destination: unknown,
        restricciones: RestriccionesRuta = {},
        avoid?: unknown,
    ): Promise<RutaNormalizada> {
        const origen = validarCoordenada(origin, 'origin');
        const destino = validarCoordenada(destination, 'destination');
        const evitar = validarPuntosEvitar(avoid);
        const barreras = await this.barrerasCriticas(
            origen,
            destino,
            MAX_PUNTOS_EVITAR - evitar.length,
        );

        if (barreras.length > 0) {
            try {
                const ruta = await this.consultar(origen, destino, restricciones, [
                    ...evitar,
                    ...barreras,
                ]);
                return conAviso(ruta, AVISO_BARRERAS_EVITADAS(barreras.length));
            } catch (error) {
                // Sin camino que evite las barreras: se calcula sin ellas.
                if (codigoDe(error) !== 'RUTA_NO_ENCONTRADA') {
                    throw error;
                }
                const ruta = await this.consultar(origen, destino, restricciones, evitar);
                return conAviso(ruta, AVISO_BARRERAS_NO_EVITABLES);
            }
        }

        return this.consultar(origen, destino, restricciones, evitar);
    }

    private async consultar(
        origen: Coordenada,
        destino: Coordenada,
        restricciones: RestriccionesRuta,
        evitar: Coordenada[],
    ): Promise<RutaNormalizada> {
        const { solicitud, advertencias } = construirSolicitudValhalla(
            origen,
            destino,
            restricciones,
            evitar,
        );
        // Tiempo límite, reintentos y mensaje de contingencia: valhalla-cliente.ts.
        const crudo = await consultarValhalla(this.valhallaUrl, solicitud);
        return normalizarRespuestaValhalla(
            crudo,
            restricciones.perfil ?? 'peatonal',
            advertencias,
        );
    }

    /**
     * Barreras críticas vigentes alrededor del trayecto (las más cercanas a
     * la línea origen–destino primero). Si la BD no responde, la ruta se
     * calcula igual: la navegación vuelve a avisar de las barreras.
     */
    private async barrerasCriticas(
        origen: Coordenada,
        destino: Coordenada,
        cupo: number,
    ): Promise<Coordenada[]> {
        if (!this.db || cupo <= 0) {
            return [];
        }
        const [latO, lonO] = origen;
        const [latD, lonD] = destino;
        try {
            const filas: { lat: number; lon: number; distancia: number }[] = await this.db.query(
                `with extremos as (
                   select st_setsrid(st_makepoint($2, $1), 4326) as o,
                          st_setsrid(st_makepoint($4, $3), 4326) as d
                 )
                 select distinct on (p.id_poi)
                        st_y(p.ubicacion::geometry)::float8 as lat,
                        st_x(p.ubicacion::geometry)::float8 as lon,
                        st_distance(p.ubicacion::geography, st_makeline(e.o, e.d)::geography) as distancia
                   from reporte r
                   join poi p on p.id_poi = r.poi_id
                   cross join extremos e
                  where r.es_critico is true
                    and r.estado <> 'rechazado'
                    and p.ubicacion::geometry && st_expand(st_makeline(e.o, e.d), $5)
                    and not st_dwithin(p.ubicacion::geography, e.o::geography, $6)
                    and not st_dwithin(p.ubicacion::geography, e.d::geography, $6)
                  order by p.id_poi`,
                [latO, lonO, latD, lonD, MARGEN_BARRERAS_GRADOS, RADIO_EXTREMOS_M],
            );
            return filas
                .sort((a, b) => Number(a.distancia ?? 0) - Number(b.distancia ?? 0))
                .slice(0, cupo)
                .map((fila) => [Number(fila.lat), Number(fila.lon)] as Coordenada);
        } catch (error) {
            this.logger.warn(
                `No se pudieron leer las barreras críticas: ${(error as Error).message}`,
            );
            return [];
        }
    }
}

function conAviso(ruta: RutaNormalizada, aviso: string): RutaNormalizada {
    return { ...ruta, advertencias: [...ruta.advertencias, aviso] };
}

function codigoDe(error: unknown): string | undefined {
    const respuesta = (error as { getResponse?: () => unknown })?.getResponse?.();
    return (respuesta as { error?: string } | undefined)?.error;
}
