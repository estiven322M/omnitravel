import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';

const ROL_POR_DEFECTO = 'viajero';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Credenciales {
  email?: unknown;
  password?: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly roles: Repository<Rol>,
    private readonly jwt: JwtService,
  ) { }

  async registrar(datos: Credenciales) {
    const { email, password } = this.validar(datos);

    // La app valida lo mismo; se repite aquí porque el servidor no puede
    // confiar en el cliente.
    if (
      password.length < 8 ||
      !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9\s]/.test(password)
    ) {
      throw new BadRequestException(
        'La contraseña debe tener mínimo 8 caracteres, con letras, números y un símbolo.',
      );
    }

    if (await this.usuarios.existsBy({ email })) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    const rol = await this.roles.findOneBy({ nombre: ROL_POR_DEFECTO });
    if (!rol) {
      throw new InternalServerErrorException(
        `No existe el rol "${ROL_POR_DEFECTO}" en la base de datos.`,
      );
    }

    const { id } = await this.usuarios.save(
      this.usuarios.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        rolId: rol.id,
      }),
    );

    return this.respuestaSesion(id, email, rol.nombre);
  }

  async iniciarSesion(datos: Credenciales) {
    const { email, password } = this.validar(datos);

    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();

    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    if (usuario.estadoCuenta !== 'activo') {
      throw new ForbiddenException('La cuenta no está activa.');
    }

    const rol = await this.roles.findOneBy({ id: usuario.rolId });
    return this.respuestaSesion(usuario.id, usuario.email, rol?.nombre ?? '');
  }

  private validar(datos: Credenciales) {
    if (typeof datos?.email !== 'string' || typeof datos?.password !== 'string') {
      throw new BadRequestException('Debes enviar email y password.');
    }
    const email = datos.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Ingresa un correo electrónico válido.');
    }
    return { email, password: datos.password };
  }

  private async respuestaSesion(id: string, email: string, rol: string) {
    const token = await this.jwt.signAsync({ sub: id, email, rol });
    return { token, usuario: { id, email, rol } };
  }
}
