import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LIMITE_AUTH } from './limite-intentos.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol]),
    // Almacén en memoria del límite de intentos (suficiente con una instancia).
    ThrottlerModule.forRoot([LIMITE_AUTH]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // RNF-25: sesión con expiración ≤ 24 h.
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthGuard],
  // Otros módulos usan JwtAuthGuard, que necesita JwtService.
  exports: [JwtModule, JwtAuthGuard, AuthGuard],
})
export class AuthModule {}
