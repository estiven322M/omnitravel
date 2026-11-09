import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoutingService } from './routing.service';
import type { RestriccionesRuta } from './valhalla-payload';

interface SolicitudRuta {
    /** [latitud, longitud] del punto de partida. */
    origin: [number, number];
    /** [latitud, longitud] del destino. */
    destination: [number, number];
    /** Restricciones de accesibilidad derivadas del perfil de la persona. */
    restrictions?: RestriccionesRuta;
    /** «Cambiar ruta»: puntos [latitud, longitud] de la ruta anterior a evitar. */
    avoid?: [number, number][];
}

/** Ruteo accesible: exige sesión (la app ya maneja el vencimiento del JWT). */
@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutingController {
    constructor(private readonly routingService: RoutingService) { }

    @Post()
    calculateRoute(@Body() body: SolicitudRuta) {
        return this.routingService.calculateRoute(
            body?.origin,
            body?.destination,
            body?.restrictions ?? {},
            body?.avoid,
        );
    }
}
