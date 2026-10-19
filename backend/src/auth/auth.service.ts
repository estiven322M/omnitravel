import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { errorDominio } from '../common/errores';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';

const ROL_POR_DEFECTO = 'viajero';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Cuentas copiadas de Supabase: la app guardaba SHA-256 hex sin sal.
const HASH_SHA256_LEGADO = /^[a-f0-9]{64}$/;
// Hash bcrypt de relleno: si el correo no existe se compara igual, para que el
// tiempo de respuesta no revele qué correos están registrados.
const HASH_DE_RELLENO = bcrypt.hashSync('relleno-no-es-una-cuenta', 10);

/** Política de contraseñas (registro, cambio y comando crear-admin). */
function exigirContrasenaSegura(password: string): void {
  if (
    password.length < 8 ||
    !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  ) {
    throw errorDominio(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'La contraseña debe tener mínimo 8 caracteres, con letras, números y un símbolo.',
    );
  }
}

export interface CambioContrasena {
  actual?: unknown;
  nueva?: unknown;
}

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
  ) {}

  async registrar(datos: Credenciales) {
    const { email, password } = this.validar(datos);

    // La app valida lo mismo; se repite aquí porque el servidor no puede
    // confiar en el cliente.
    exigirContrasenaSegura(password);

    if (await this.usuarios.existsBy({ email })) {
      throw errorDominio(
        HttpStatus.CONFLICT,
        'EMAIL_ALREADY_REGISTERED',
        'El correo electrónico ya está registrado.',
      );
    }

    const rol = await this.roles.findOneBy({ nombre: ROL_POR_DEFECTO });
    if (!rol) {
      throw errorDominio(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'INTERNAL_ERROR',
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

    return this.respuestaSesion(id, email, rol);
  }

  async iniciarSesion(datos: Credenciales) {
    const { email, password } = this.validar(datos);

    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();

    if (!usuario) {
      await bcrypt.compare(password, HASH_DE_RELLENO);
    }
    if (!usuario || !(await this.contrasenaValida(usuario, password))) {
      throw errorDominio(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Correo o contraseña incorrectos.',
      );
    }
    if (usuario.estadoCuenta !== 'activo') {
      throw errorDominio(
        HttpStatus.FORBIDDEN,
        'USER_INACTIVE',
        'La cuenta no está activa.',
      );
    }

    const rol = await this.roles.findOneBy({ id: usuario.rolId });
    return this.respuestaSesion(usuario.id, usuario.email, rol);
  }

  /** M07 «Cambiar contraseña»: exige la contraseña actual. */
  async cambiarContrasena(usuarioId: string, datos: CambioContrasena) {
    if (typeof datos?.actual !== 'string' || typeof datos?.nueva !== 'string') {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Debes enviar la contraseña actual y la nueva.',
      );
    }
    exigirContrasenaSegura(datos.nueva);
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: usuarioId })
      .getOne();
    if (!usuario || !(await this.contrasenaValida(usuario, datos.actual))) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'CONTRASENA_ACTUAL_INCORRECTA',
        'La contraseña actual no es correcta.',
      );
    }
    if (datos.actual === datos.nueva) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'La nueva contraseña debe ser distinta de la actual.',
      );
    }
    await this.usuarios.update(usuario.id, {
      passwordHash: await bcrypt.hash(datos.nueva, 10),
    });
    return { actualizada: true };
  }

  /**
   * Compara contra bcrypt. Las cuentas migradas desde Supabase traen SHA-256;
   * si coincide, se reemplaza por bcrypt para que el hash débil desaparezca.
   */
  private async contrasenaValida(usuario: Usuario, password: string) {
    if (HASH_SHA256_LEGADO.test(usuario.passwordHash)) {
      const sha = createHash('sha256').update(password).digest('hex');
      if (sha !== usuario.passwordHash) {
        return false;
      }
      await this.usuarios.update(usuario.id, {
        passwordHash: await bcrypt.hash(password, 10),
      });
      return true;
    }
    return bcrypt.compare(password, usuario.passwordHash);
  }

  private validar(datos: Credenciales) {
    if (
      typeof datos?.email !== 'string' ||
      typeof datos?.password !== 'string'
    ) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Debes enviar email y password.',
      );
    }
    const email = datos.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Ingresa un correo electrónico válido.',
      );
    }
    return { email, password: datos.password };
  }

  private async respuestaSesion(id: string, email: string, rol: Rol | null) {
    const nombreRol = rol?.nombre ?? ROL_POR_DEFECTO;
    const token = await this.jwt.signAsync({ sub: id, email, rol: nombreRol });
    return {
      token,
      usuario: {
        id_usuario: Number(id),
        email,
        rol_id: rol ? Number(rol.id) : null,
        rol: nombreRol,
      },
    };
  }
}
