import { Module } from '@nestjs/common';
import { FotosController } from './fotos.controller';
import { FotosService } from './fotos.service';
import { MapaController } from './mapa.controller';
import { MapaService } from './mapa.service';

@Module({
  controllers: [MapaController, FotosController],
  providers: [MapaService, FotosService],
})
export class MapaModule { }
