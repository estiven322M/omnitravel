import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, UsuarioActual, type UsuarioToken } from '../auth/jwt-auth.guard';
import { ReportesService, type DatosNuevoReporte } from './reportes.service';

@Controller()
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) { }

  // POST /reportes — crear reporte (U09/U10)
  @Post('reportes')
  @UseGuards(JwtAuthGuard)
  crear(@UsuarioActual() usuario: UsuarioToken, @Body() body: DatosNuevoReporte) {
    return this.reportesService.crear(usuario.id, body);
  }

  // GET /reportes/mios — reportes de la persona autenticada (U12)
  @Get('reportes/mios')
  @UseGuards(JwtAuthGuard)
  mios(@UsuarioActual() usuario: UsuarioToken) {
    return this.reportesService.listarMios(usuario.id);
  }

  // GET /reportes/barreras — barreras críticas vigentes, público (mapa U06)
  @Get('reportes/barreras')
  barreras() {
    return this.reportesService.listarBarreras();
  }

  // GET /reportes?page=1&limit=10 — consulta paginada (solo lectura)
  @Get('reportes')
  @UseGuards(JwtAuthGuard)
  listarPaginado(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.reportesService.listarPaginado(page, limit);
  }

  // GET /reportes/:id — un reporte (solo lectura). Va después de /mios y
  // /barreras para que esas rutas no se confundan con un id.
  @Get('reportes/:id')
  @UseGuards(JwtAuthGuard)
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.reportesService.obtener(String(id));
  }

  // POST /reportes/:id/confirmaciones — confirmar (C3)
  @Post('reportes/:id/confirmaciones')
  @UseGuards(JwtAuthGuard)
  confirmar(@UsuarioActual() usuario: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.reportesService.confirmar(usuario.id, String(id));
  }

  // POST /reportes/:id/denuncias  { motivo, descripcion? } — denunciar (C4)
  @Post('reportes/:id/denuncias')
  @UseGuards(JwtAuthGuard)
  denunciar(
    @UsuarioActual() usuario: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivo?: unknown; descripcion?: unknown },
  ) {
    return this.reportesService.denunciar(usuario.id, String(id), body);
  }

  // GET /pois/:id/reporte-activo — público (ficha U08)
  @Get('pois/:id/reporte-activo')
  reporteActivo(@Param('id', ParseIntPipe) id: number) {
    return this.reportesService.reporteActivo(String(id));
  }

  // GET /moderacion/reportes?estado=pendiente_validacion (sin estado = todos) — moderador/administrador (M03)
  @Get('moderacion/reportes')
  @UseGuards(JwtAuthGuard)
  listar(@UsuarioActual() usuario: UsuarioToken, @Query('estado') estado?: string) {
    return this.reportesService.listarModeracion(usuario.id, estado);
  }

  // POST /moderacion/reportes/:id/decision  { accion: 'aprobado'|'rechazado', motivo? } (M05)
  @Post('moderacion/reportes/:id/decision')
  @UseGuards(JwtAuthGuard)
  decidir(
    @UsuarioActual() usuario: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { accion?: string; motivo?: string | null },
  ) {
    return this.reportesService.decidir(usuario.id, String(id), body?.accion, body?.motivo);
  }
}
