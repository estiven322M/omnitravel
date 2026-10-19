import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../authorization/roles.guard';

describe('DatabaseController', () => {
    let controller: DatabaseController;
    let databaseService: {
        query: jest.Mock;
    };

    beforeEach(async () => {
        databaseService = {
            query: jest.fn().mockResolvedValue({
                rows: [
                    {
                        postgres_version: 'PostgreSQL test',
                        postgis_version: 'PostGIS test',
                    },
                ],
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DatabaseController],
            providers: [
                {
                    provide: DatabaseService,
                    useValue: databaseService,
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<DatabaseController>(DatabaseController);
    });

    it('debe devolver el diagnóstico cuando la consulta funciona', async () => {
        await expect(controller.diagnostic()).resolves.toEqual({
            status: 'ok',
            database: {
                postgres_version: 'PostgreSQL test',
                postgis_version: 'PostGIS test',
            },
        });
    });

    it('debe devolver un error 503 si falla la consulta', async () => {
        databaseService.query.mockRejectedValueOnce(
            new Error('Error simulado'),
        );

        await expect(controller.diagnostic()).rejects.toMatchObject({
            status: 503,
        });
    });
});
