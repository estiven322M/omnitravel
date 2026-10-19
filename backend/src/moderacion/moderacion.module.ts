import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModeracionController } from './moderacion.controller';
import { ModeracionService } from './moderacion.service';

@Module({
  imports: [AuthModule],
  controllers: [ModeracionController],
  providers: [ModeracionService],
})
export class ModeracionModule { }
