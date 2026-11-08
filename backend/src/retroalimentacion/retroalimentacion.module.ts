import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RetroalimentacionController } from './retroalimentacion.controller';
import { RetroalimentacionService } from './retroalimentacion.service';

@Module({
  imports: [AuthModule],
  controllers: [RetroalimentacionController],
  providers: [RetroalimentacionService],
})
export class RetroalimentacionModule {}
