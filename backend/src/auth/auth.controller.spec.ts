import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LIMITE_AUTH } from './limite-intentos.guard';

describe('AuthController — límite de intentos', () => {
  let app: INestApplication;
  const authService = {
    iniciarSesion: jest.fn().mockResolvedValue({ token: 't', usuario: {} }),
    registrar: jest.fn().mockResolvedValue({ token: 't', usuario: {} }),
  };

  beforeEach(async () => {
    authService.iniciarSesion.mockClear();
    const modulo = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([LIMITE_AUTH])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      // El cambio de contraseña usa JwtAuthGuard; aquí solo importa el límite.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.co', password: 'x' });

  it(`permite ${LIMITE_AUTH.limit} intentos por minuto y luego responde 429`, async () => {
    for (let i = 0; i < LIMITE_AUTH.limit; i++) {
      await login().expect(200);
    }

    const bloqueado = await login().expect(429);

    expect(bloqueado.body.message).toBe(
      'DEMASIADOS_INTENTOS: Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    );
    expect(authService.iniciarSesion).toHaveBeenCalledTimes(LIMITE_AUTH.limit);
  });
});
