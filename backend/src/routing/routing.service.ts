import { Injectable } from '@nestjs/common';
import { consultarValhalla } from './valhalla-cliente';
import {
    construirSolicitudValhalla,
    normalizarRespuestaValhalla,
    validarCoordenada,
    validarPuntosEvitar,
    type RestriccionesRuta,
    type RutaNormalizada,
} from './valhalla-payload';

/**
 * Proceso 2 — Motor de rutas accesibles.
 *
 * Traduce la petición de la app (`POST /routes`) a una solicitud peatonal de
 * Valhalla con las restricciones de accesibilidad del perfil y normaliza la
 * respuesta (distancia, duración, pasos y advertencias). El detalle del
 * contrato vive en `valhalla-payload.ts`.
 */
@Injectable()
export class RoutingService {
    private readonly valhallaUrl =
        process.env.VALHALLA_URL ?? 'http://localhost:8002';

    async calculateRoute(
        origin: unknown,
        destination: unknown,
        restricciones: RestriccionesRuta = {},
        avoid?: unknown,
    ): Promise<RutaNormalizada> {
        const origen = validarCoordenada(origin, 'origin');
        const destino = validarCoordenada(destination, 'destination');
        const evitar = validarPuntosEvitar(avoid);
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
}
