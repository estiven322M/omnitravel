import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FotosService } from './fotos.service';

@Controller('fotos')
export class FotosController {
  constructor(private readonly fotos: FotosService) { }

  // GET /fotos/:id — público, como GET /mapa (fotos con licencia libre).
  @Get(':id')
  async foto(@Param('id') id: string, @Res() res: Response) {
    const { datos, tipo } = await this.fotos.obtener(id);
    res.set({ 'Content-Type': tipo, 'Cache-Control': 'public, max-age=604800, immutable' });
    res.send(datos);
  }
}
