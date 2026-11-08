import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  UsuarioActual,
  type UsuarioToken,
} from '../auth/jwt-auth.guard';
import {
  RetroalimentacionService,
  type DatosRetroalimentacion,
} from './retroalimentacion.service';

/** Proceso 3: retroalimentación post-viaje del viajero (U13). Exige sesión. */
@ApiTags('retroalimentacion')
@ApiBearerAuth('access-token')
@Controller('retroalimentacion')
@UseGuards(JwtAuthGuard)
export class RetroalimentacionController {
  constructor(private readonly retroalimentacion: RetroalimentacionService) {}

  // POST /retroalimentacion { poiId, calificacion, comentario?, coincide?, tipoDiscrepancia?, descripcionDiscrepancia? }
  @Post()
  registrar(
    @UsuarioActual() usuario: UsuarioToken,
    @Body() body: DatosRetroalimentacion,
  ) {
    return this.retroalimentacion.registrar(usuario.id, body ?? {});
  }

  // GET /retroalimentacion/mias — experiencias propias y estado de su incidencia
  @Get('mias')
  mias(@UsuarioActual() usuario: UsuarioToken) {
    return this.retroalimentacion.listarMias(usuario.id);
  }
}
