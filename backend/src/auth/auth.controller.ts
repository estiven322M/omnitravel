import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService, type Credenciales } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // POST /auth/register  { email, password }
  @Post('register')
  register(@Body() body: Credenciales) {
    return this.authService.registrar(body);
  }

  // POST /auth/login  { email, password }
  @Post('login')
  @HttpCode(200)
  login(@Body() body: Credenciales) {
    return this.authService.iniciarSesion(body);
  }
}
