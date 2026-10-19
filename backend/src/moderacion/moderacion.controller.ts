import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, UsuarioActual, type UsuarioToken } from '../auth/jwt-auth.guard';
import { ModeracionService } from './moderacion.service';

/** Panel de moderación: tablero (M02), incidencias (M06) y perfil (M07). */
@ApiTags('moderacion')
@ApiBearerAuth('access-token')
@Controller('moderacion')
@UseGuards(JwtAuthGuard)
export class ModeracionController {
  constructor(private readonly moderacion: ModeracionService) { }

  @Get('resumen')
  resumen(@UsuarioActual() usuario: UsuarioToken) {
    return this.moderacion.resumen(usuario.id);
  }

  @Get('incidencias')
  incidencias(@UsuarioActual() usuario: UsuarioToken) {
    return this.moderacion.incidencias(usuario.id);
  }

  @Post('incidencias/:id/desactivar-punto')
  desactivarPunto(@UsuarioActual() usuario: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.moderacion.desactivarPunto(usuario.id, id);
  }

  @Post('incidencias/:id/solicitar-evidencia')
  solicitarEvidencia(@UsuarioActual() usuario: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.moderacion.solicitarEvidencia(usuario.id, id);
  }
}
