import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  UsuarioActual,
  type UsuarioToken,
} from '../auth/jwt-auth.guard';
import {
  FeedbackService,
  type DatosExperiencia,
  type DatosVisita,
} from './feedback.service';

/**
 * Proceso 3 — API de visitas y retroalimentación post-viaje.
 * Sin prefijo global: las rutas son /visitas, /experiences, /incidents y
 * /pois/:id/experiences (las experiencias públicas no exigen sesión).
 */
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // POST /visitas  { poi_id } — inicia la visita al entrar a la navegación.
  @Post('visitas')
  @UseGuards(JwtAuthGuard)
  iniciarVisita(
    @UsuarioActual() usuario: UsuarioToken,
    @Body() body: DatosVisita,
  ) {
    return this.feedbackService.iniciarVisita(usuario.id, body);
  }

  // GET /visitas/pendientes — visitas completadas sin calificar.
  @Get('visitas/pendientes')
  @UseGuards(JwtAuthGuard)
  pendientes(@UsuarioActual() usuario: UsuarioToken) {
    return this.feedbackService.visitasPendientes(usuario.id);
  }

  // POST /visitas/:id/finalizar — cierra la visita y habilita el feedback.
  @Post('visitas/:id/finalizar')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  finalizar(
    @UsuarioActual() usuario: UsuarioToken,
    @Param('id') id: string,
  ) {
    return this.feedbackService.finalizarVisita(usuario.id, id);
  }

  // POST /experiences — califica una visita completada (una sola vez).
  @Post('experiences')
  @UseGuards(JwtAuthGuard)
  crearExperiencia(
    @UsuarioActual() usuario: UsuarioToken,
    @Body() body: DatosExperiencia,
  ) {
    return this.feedbackService.crearExperiencia(usuario.id, body);
  }

  // GET /incidents — incidencias propias del viajero autenticado.
  @Get('incidents')
  @UseGuards(JwtAuthGuard)
  incidencias(@UsuarioActual() usuario: UsuarioToken) {
    return this.feedbackService.incidenciasDeUsuario(usuario.id);
  }

  // GET /pois/:id/experiences — experiencias públicas del lugar.
  @Get('pois/:id/experiences')
  experiencias(@Param('id') id: string) {
    return this.feedbackService.experienciasDePoi(id);
  }
}
