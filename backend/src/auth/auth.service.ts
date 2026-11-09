import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { errorDominio } from '../common/errores';
import { Rol } from '../usuarios/rol.entity';
import { Usuario } from '../usuarios/usuario.entity';

const ROL_POR_DEFECTO = 'viajero';
const ROL_ADMINISTRADOR = 'administrador';
const ROLES_DE_REGISTRO = new Set([ROL_POR_DEFECTO, ROL_ADMINISTRADOR]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Cuentas copiadas de Supabase: la app guardaba SHA-256 hex sin sal.
const HASH_SHA256_LEGADO = /^[a-f0-9]{64}$/;
// Hash bcrypt de relleno: si el correo no existe se compara igual, para que el
// tiempo de respuesta no revele qué correos están registrados.
const HASH_DE_RELLENO = bcrypt.hashSync('relleno-no-es-una-cuenta', 10);

/** Compara dos textos en tiempo constante (código de invitación). */
function igualdadSegura(a: string, b: string): boolean {
  const izquierda = Buffer.from(a);
  const derecha = Buffer.from(b);
  if (izquierda.length !== derecha.length) {
    // Se compara algo consigo mismo para no filtrar la longitud por tiempo.
    timingSafeEqual(derecha, derecha);
    return false;
  }
  return timingSafeEqual(izquierda, derecha);
}

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
  /** 'viajero' (por defecto) o 'administrador' con código de invitación. */
  rol?: unknown;
  codigoInvitacion?: unknown;
}

/** Eventos de cuenta que quedan en `registro_auditoria` (auditoría 6.7 ítem 9). */
export type EventoCuenta =
  | 'registro_cuenta'
  | 'inicio_sesion'
  | 'inicio_sesion_fallido'
  | 'cambio_contrasena';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly roles: Repository<Rol>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registrar(datos: Credenciales) {
    const { email, password } = this.validar(datos);

    // La app valida lo mismo; se repite aquí porque el servidor no puede
    // confiar en el cliente.
    exigirContrasenaSegura(password);
    const nombreRol = this.rolDeRegistro(datos);

    if (await this.usuarios.existsBy({ email })) {
      throw errorDominio(
        HttpStatus.CONFLICT,
        'EMAIL_ALREADY_REGISTERED',
        'El correo electrónico ya está registrado.',
      );
    }

    const rol = await this.roles.findOneBy({ nombre: nombreRol });
    if (!rol) {
      throw errorDominio(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'INTERNAL_ERROR',
        `No existe el rol "${nombreRol}" en la base de datos.`,
      );
    }

    const { id } = await this.usuarios.save(
      this.usuarios.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        rolId: rol.id,
      }),
    );

    // Asignar un rol al crear la cuenta es un cambio de rol: queda auditado.
    await this.auditar(id, 'registro_cuenta', { rol: rol.nombre });
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
      if (usuario) {
        await this.auditar(usuario.id, 'inicio_sesion_fallido', {
          motivo: 'contrasena_incorrecta',
        });
      }
      throw errorDominio(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Correo o contraseña incorrectos.',
      );
    }
    if (usuario.estadoCuenta !== 'activo') {
      await this.auditar(usuario.id, 'inicio_sesion_fallido', {
        motivo: 'cuenta_inactiva',
      });
      throw errorDominio(
        HttpStatus.FORBIDDEN,
        'USER_INACTIVE',
        'La cuenta no está activa.',
      );
    }

    const rol = await this.roles.findOneBy({ id: usuario.rolId });
    await this.auditar(usuario.id, 'inicio_sesion', {
      rol: rol?.nombre ?? ROL_POR_DEFECTO,
    });
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
    await this.auditar(usuario.id, 'cambio_contrasena', {});
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

  /**
   * Rol solicitado en el registro. Solo se permite viajero (por defecto) o
   * administrador con el código de invitación configurado en el servidor;
   * nunca se acepta un rol privilegiado enviado libremente por el cliente.
   */
  private rolDeRegistro(datos: Credenciales): string {
    const solicitado = datos?.rol;
    if (solicitado === undefined || solicitado === null || solicitado === '') {
      return ROL_POR_DEFECTO;
    }
    if (typeof solicitado !== 'string' || !ROLES_DE_REGISTRO.has(solicitado)) {
      throw errorDominio(
        HttpStatus.BAD_REQUEST,
        'ROL_INVALIDO',
        'Solo puedes registrarte como viajero o administrador.',
      );
    }
    if (solicitado === ROL_POR_DEFECTO) {
      return ROL_POR_DEFECTO;
    }

    const esperado = this.config.get<string>('ADMIN_INVITE_CODE')?.trim();
    if (!esperado) {
      throw errorDominio(
        HttpStatus.FORBIDDEN,
        'REGISTRO_ADMIN_NO_DISPONIBLE',
        'El registro de administrador no está habilitado.',
      );
    }
    const codigo = datos?.codigoInvitacion;
    if (
      typeof codigo !== 'string' ||
      !igualdadSegura(codigo.trim(), esperado)
    ) {
      throw errorDominio(
        HttpStatus.FORBIDDEN,
        'CODIGO_INVITACION_INVALIDO',
        'El código de invitación no es válido.',
      );
    }
    return ROL_ADMINISTRADOR;
  }

  /**
   * Registra un evento de cuenta. Nunca guarda la contraseña ni el correo en
   * el detalle (el usuario ya identifica la cuenta). Si la tabla no responde,
   * se deja constancia en el log y el inicio de sesión continúa.
   */
  private async auditar(
    usuarioId: string,
    accion: EventoCuenta,
    detalle: Record<string, string>,
  ): Promise<void> {
    try {
      await this.usuarios.manager.query(
        `insert into registro_auditoria (usuario_id, accion, detalle)
         values ($1, $2, $3::jsonb)`,
        [usuarioId, accion, JSON.stringify(detalle)],
      );
    } catch {
      this.logger.warn(
        `No se pudo registrar el evento ${accion} en la auditoría.`,
      );
    }
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
