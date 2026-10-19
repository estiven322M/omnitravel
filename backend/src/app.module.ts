import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EvidenciasModule } from './evidencias/evidencias.module';
import { HealthModule } from './health/health.module';
import { MapaModule } from './mapa/mapa.module';
import { FavoritosModule } from './favoritos/favoritos.module';
import { ModeracionModule } from './moderacion/moderacion.module';
import { ReportesModule } from './reportes/reportes.module';
import { RoutingModule } from './routing/routing.module';
import { DatabaseModule } from './database/database.module';
import { DatabaseDiagnosticModule } from './database/database-diagnostic.module';
import { PoisModule } from './pois/pois.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { opcionesSsl, telemetriaActiva, urlSinParametrosSsl } from './config/seguridad';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // PostgreSQL en AWS RDS (base omnitravel_db); la URL viene de DATABASE_URL.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: urlSinParametrosSsl(config.get<string>('DATABASE_URL')),
        ssl: opcionesSsl(
          config.get<string>('DB_SSL'),
          config.get<string>('DB_SSL_CA'),
        ),
        autoLoadEntities: true,
        synchronize: false, // las tablas ya existen en AWS; no dejar que TypeORM las modifique
      }),
    }),
    // Telemetría externa: solo con credenciales propias del equipo.
    ...(telemetriaActiva(process.env)
      ? [
          ObserveModule.forRoot({
            appKey: process.env.OBSERVE_APP_KEY as string,
            appSecret: process.env.OBSERVE_APP_SECRET as string,
            serviceId: 'backend',
          }),
        ]
      : []),
    DatabaseModule,
    AuthModule,
    EvidenciasModule,
    HealthModule,
    MapaModule,
    FavoritosModule,
    ModeracionModule,
    ReportesModule,
    RoutingModule,
    // Módulos de Jhon (main): roles, diagnóstico y consultas de solo lectura.
    DatabaseDiagnosticModule,
    PoisModule,
    ReportsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
