import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RoutingModule } from './routing/routing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    AuthModule,
    HealthModule,
    RoutingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }