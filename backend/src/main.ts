import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Permite llamadas desde la app en modo web (npx expo start --web).
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
