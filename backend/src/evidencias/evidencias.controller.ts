import { Body, Controller, Get, HttpStatus, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, UsuarioActual, type UsuarioToken } from '../auth/jwt-auth.guard';
import { errorDominio } from '../common/errores';
import { EvidenciasService, PATRON_ARCHIVO, PATRON_USUARIO } from './evidencias.service';
import { firmaValida, secretoEvidencias } from './firma-evidencia';

@Controller('evidencias')
export class EvidenciasController {
  constructor(private readonly evidenciasService: EvidenciasService) { }

  // POST /evidencias  { base64, mimeType } → { storageKey }
  @Post()
  @UseGuards(JwtAuthGuard)
  subir(
    @UsuarioActual() usuario: UsuarioToken,
    @Body() body: { base64?: unknown; mimeType?: unknown },
  ) {
    return this.evidenciasService.guardar(usuario.id, body?.base64, body?.mimeType);
  }

  // GET /evidencias/archivo/:usuario/:archivo?exp=…&firma=… — solo con el
  // permiso temporal que el backend entrega a los moderadores (firma-evidencia.ts).
  @Get('archivo/:usuario/:archivo')
  async archivo(
    @Param('usuario') usuario: string,
    @Param('archivo') archivo: string,
    @Query('exp') exp: unknown,
    @Query('firma') firma: unknown,
    @Res() res: Response,
  ) {
    // Los patrones impiden rutas como "../" fuera de la carpeta de evidencias.
    if (!PATRON_USUARIO.test(usuario) || !PATRON_ARCHIVO.test(archivo)) {
      throw errorDominio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'La foto no existe.');
    }
    if (!firmaValida(`${usuario}/${archivo}`, exp, firma, secretoEvidencias())) {
      throw errorDominio(
        HttpStatus.FORBIDDEN,
        'ENLACE_NO_VALIDO',
        'El enlace de la foto no es válido o ya venció.',
      );
    }
    if (this.evidenciasService.bucket) {
      const foto = await this.evidenciasService.leerDeS3(`${usuario}/${archivo}`);
      if (!foto) {
        throw errorDominio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'La foto no existe.');
      }
      res.setHeader('Content-Type', foto.tipo);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      foto.cuerpo.pipe(res);
      return;
    }
    res.sendFile(`${usuario}/${archivo}`, { root: this.evidenciasService.directorio }, (error) => {
      if (error && !res.headersSent) {
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'NOT_FOUND',
          message: 'NOT_FOUND: La foto no existe.',
        });
      }
    });
  }
}
