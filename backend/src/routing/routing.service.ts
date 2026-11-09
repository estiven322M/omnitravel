import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
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

        let crudo: unknown;
        try {
            const response = await fetch(`${this.valhallaUrl}/route`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(solicitud),
            });

            if (!response.ok) {
                const error = await response.text();

                throw new InternalServerErrorException(
                    `Valhalla respondió con ${response.status}: ${error}`,
                );
            }

            crudo = await response.json();
        } catch (error) {
            if (error instanceof InternalServerErrorException) {
                throw error;
            }

            throw new InternalServerErrorException(
                'No fue posible comunicarse con el motor de ruteo.',
            );
        }

        return normalizarRespuestaValhalla(
            crudo,
            restricciones.perfil ?? 'peatonal',
            advertencias,
        );
    }
}
