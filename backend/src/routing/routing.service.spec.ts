import { HttpStatus } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { errorDominio } from '../common/errores';
import {
    AVISO_BARRERAS_EVITADAS,
    AVISO_BARRERAS_NO_EVITABLES,
    RoutingService,
} from './routing.service';
import { consultarValhalla } from './valhalla-cliente';

jest.mock('./valhalla-cliente', () => ({ consultarValhalla: jest.fn() }));

const consultar = consultarValhalla as jest.MockedFunction<typeof consultarValhalla>;

const TRIP = {
    trip: {
        summary: { length: 1.2, time: 900 },
        legs: [{ shape: 'abc', maneuvers: [{ type: 1, instruction: 'Sigue', length: 1.2 }] }],
    },
};

function bdCon(filas: unknown[] | Error): DataSource {
    return {
        query: jest.fn(() =>
            filas instanceof Error ? Promise.reject(filas) : Promise.resolve(filas),
        ),
    } as unknown as DataSource;
}

const ORIGEN = [4.53, -75.67];
const DESTINO = [4.55, -75.66];

describe('RoutingService — barreras críticas (RT1, RNF-26)', () => {
    beforeEach(() => consultar.mockReset());

    it('excluye las barreras críticas cercanas y lo advierte', async () => {
        consultar.mockResolvedValue(TRIP);
        const servicio = new RoutingService(
            bdCon([
                { lat: 4.54, lon: -75.665, distancia: 30 },
                { lat: 4.545, lon: -75.664, distancia: 10 },
            ]),
        );

        const ruta = await servicio.calculateRoute(ORIGEN, DESTINO, {});

        const solicitud = consultar.mock.calls[0][1] as {
            exclude_locations?: { lat: number; lon: number }[];
        };
        // La más cercana al trayecto va primero.
        expect(solicitud.exclude_locations).toEqual([
            { lat: 4.545, lon: -75.664 },
            { lat: 4.54, lon: -75.665 },
        ]);
        expect(ruta.advertencias).toContain(AVISO_BARRERAS_EVITADAS(2));
    });

    it('si no hay camino que las evite, calcula sin ellas y avisa', async () => {
        consultar
            .mockRejectedValueOnce(
                errorDominio(HttpStatus.UNPROCESSABLE_ENTITY, 'RUTA_NO_ENCONTRADA', 'x'),
            )
            .mockResolvedValueOnce(TRIP);
        const servicio = new RoutingService(bdCon([{ lat: 4.54, lon: -75.665, distancia: 5 }]));

        const ruta = await servicio.calculateRoute(ORIGEN, DESTINO, {});

        expect(consultar).toHaveBeenCalledTimes(2);
        expect(consultar.mock.calls[1][1]).not.toHaveProperty('exclude_locations');
        expect(ruta.advertencias).toContain(AVISO_BARRERAS_NO_EVITABLES);
    });

    it('respeta el máximo de 8 puntos a evitar junto con «Cambiar ruta»', async () => {
        consultar.mockResolvedValue(TRIP);
        const barreras = Array.from({ length: 6 }, (_, i) => ({
            lat: 4.54 + i / 1000,
            lon: -75.665,
            distancia: i,
        }));
        const servicio = new RoutingService(bdCon(barreras));
        const previos = Array.from({ length: 5 }, (_, i) => [4.531 + i / 1000, -75.669]);

        await servicio.calculateRoute(ORIGEN, DESTINO, {}, previos);

        const solicitud = consultar.mock.calls[0][1] as { exclude_locations: unknown[] };
        expect(solicitud.exclude_locations).toHaveLength(8);
    });

    it('si la BD falla, la ruta se calcula igual (sin barreras)', async () => {
        consultar.mockResolvedValue(TRIP);
        const servicio = new RoutingService(bdCon(new Error('sin conexión')));

        const ruta = await servicio.calculateRoute(ORIGEN, DESTINO, {});

        expect(consultar.mock.calls[0][1]).not.toHaveProperty('exclude_locations');
        expect(ruta.advertencias).toEqual([]);
    });

    it('otros errores del motor no se ocultan', async () => {
        consultar.mockRejectedValue(
            errorDominio(HttpStatus.SERVICE_UNAVAILABLE, 'RUTEO_NO_DISPONIBLE', 'x'),
        );
        const servicio = new RoutingService(bdCon([{ lat: 4.54, lon: -75.665, distancia: 5 }]));

        await expect(servicio.calculateRoute(ORIGEN, DESTINO, {})).rejects.toThrow(
            'RUTEO_NO_DISPONIBLE',
        );
        expect(consultar).toHaveBeenCalledTimes(1);
    });
});
