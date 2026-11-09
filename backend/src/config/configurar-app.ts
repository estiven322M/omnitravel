import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { OPCIONES_HELMET, origenesCors, swaggerHabilitado } from './seguridad';

/**
 * Configuración HTTP de la API, compartida por `main.ts` y por las pruebas de
 * integración, para que estas ejerciten exactamente lo que corre en producción.
 */
export function configurarApp(
  app: NestExpressApplication,
  entorno: NodeJS.ProcessEnv = process.env,
): void {
  // Cabeceras de seguridad HTTP (auditoría 6.7 ítem 5). Swagger UI necesita
  // scripts y estilos propios, así que su ruta usa la CSP por defecto de helmet.
  const docs = swaggerHabilitado(entorno);
  const cabeceras = helmet(OPCIONES_HELMET);
  const cabecerasDocs = helmet({
    crossOriginResourcePolicy: OPCIONES_HELMET.crossOriginResourcePolicy,
  });
  app.use((req: { path: string }, res: unknown, next: () => void) =>
    (docs && req.path.startsWith('/api/docs') ? cabecerasDocs : cabeceras)(
      req as never,
      res as never,
      next,
    ),
  );
  // Las fotos de evidencia llegan en base64 (≤ 5 MB → ~6,7 MB en JSON).
  app.useBodyParser('json', { limit: '8mb' });
  // Solo afecta a clientes web (Expo web); la app nativa no usa CORS.
  app.enableCors({ origin: origenesCors(entorno.CORS_ORIGINS) });
  // Validación de DTOs (class-validator). Los cuerpos tipados con interfaces
  // (auth, reportes, evidencias, rutas) no se ven afectados: los validan sus servicios.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentación interactiva en /api/docs: en producción solo con
  // SWAGGER_PUBLICO=true (auditoría 6.7 ítem 5, riesgo 5).
  if (docs) {
    publicarSwagger(app);
  } else {
    new Logger('Bootstrap').log(
      'Swagger deshabilitado en producción (SWAGGER_PUBLICO no es true).',
    );
  }
}

function publicarSwagger(app: NestExpressApplication) {
  const swagger = new DocumentBuilder()
    .setTitle('OmniTravel API')
    .setDescription(
      'Backend de OmniTravel. Los endpoints protegidos requieren el JWT de POST /auth/login en formato Bearer.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, swagger),
  );
}
