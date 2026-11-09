import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import type { Rol } from '../usuarios/rol.entity';
import type { Usuario } from '../usuarios/usuario.entity';
import { AuthService } from './auth.service';

const CONTRASENA = 'Segura123!';
const CODIGO = 'OMNI-ADMIN-2026';

function crearServicio(
  opciones: {
    codigo?: string;
    existe?: boolean;
    rol?: { id: string; nombre: string } | null;
  } = {},
) {
  const usuarios = {
    existsBy: jest.fn().mockResolvedValue(opciones.existe ?? false),
    create: jest.fn((datos: unknown) => datos),
    save: jest.fn().mockResolvedValue({ id: '42' }),
    manager: { query: jest.fn().mockResolvedValue([]) },
    createQueryBuilder: jest.fn(),
  };
  const roles = {
    findOneBy: jest
      .fn()
      .mockResolvedValue(
        opciones.rol === undefined
          ? { id: '1', nombre: 'viajero' }
          : opciones.rol,
      ),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt') };
  const config = { get: jest.fn().mockReturnValue(opciones.codigo) };
  const servicio = new AuthService(
    usuarios as unknown as Repository<Usuario>,
    roles as unknown as Repository<Rol>,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );
  return { servicio, usuarios, roles, config };
}

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

const codigo = (error: HttpException) =>
  (error.getResponse() as { error: string }).error;

describe('AuthService — registro de viajero y administrador', () => {
  it('registra viajero por defecto y normaliza el correo', async () => {
    const { servicio, usuarios, roles } = crearServicio();
    const resultado = await servicio.registrar({
      email: '  NUEVA@OmniTravel.test ',
      password: CONTRASENA,
    });

    expect(resultado.usuario.rol).toBe('viajero');
    expect(usuarios.existsBy).toHaveBeenCalledWith({
      email: 'nueva@omnitravel.test',
    });
    expect(roles.findOneBy).toHaveBeenCalledWith({ nombre: 'viajero' });
    expect(resultado.token).toBe('jwt');
  });

  it('permite crear administrador con el código de invitación correcto', async () => {
    const { servicio, roles, config } = crearServicio({
      codigo: CODIGO,
      rol: { id: '5', nombre: 'administrador' },
    });
    const resultado = await servicio.registrar({
      email: 'admin2@omnitravel.test',
      password: CONTRASENA,
      rol: 'administrador',
      codigoInvitacion: CODIGO,
    });

    expect(config.get).toHaveBeenCalledWith('ADMIN_INVITE_CODE');
    expect(roles.findOneBy).toHaveBeenCalledWith({ nombre: 'administrador' });
    expect(resultado.usuario.rol).toBe('administrador');
    expect(resultado.usuario.rol_id).toBe(5);
  });

  it('rechaza el registro de administrador si el servidor no tiene código', async () => {
    const { servicio, usuarios } = crearServicio({ codigo: undefined });
    const error = await capturar(
      servicio.registrar({
        email: 'admin2@omnitravel.test',
        password: CONTRASENA,
        rol: 'administrador',
        codigoInvitacion: CODIGO,
      }),
    );

    expect(error.getStatus()).toBe(403);
    expect(codigo(error)).toBe('REGISTRO_ADMIN_NO_DISPONIBLE');
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('rechaza un código de invitación incorrecto', async () => {
    const { servicio, usuarios } = crearServicio({ codigo: CODIGO });
    const error = await capturar(
      servicio.registrar({
        email: 'admin2@omnitravel.test',
        password: CONTRASENA,
        rol: 'administrador',
        codigoInvitacion: 'NO-ES-EL-CODIGO',
      }),
    );

    expect(error.getStatus()).toBe(403);
    expect(codigo(error)).toBe('CODIGO_INVITACION_INVALIDO');
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('no permite elegir moderador ni establecimiento desde el registro', async () => {
    const { servicio, usuarios } = crearServicio();
    const error = await capturar(
      servicio.registrar({
        email: 'otro@omnitravel.test',
        password: CONTRASENA,
        rol: 'moderador',
      }),
    );

    expect(error.getStatus()).toBe(400);
    expect(codigo(error)).toBe('ROL_INVALIDO');
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('rechaza un correo ya registrado', async () => {
    const { servicio } = crearServicio({ existe: true });
    const error = await capturar(
      servicio.registrar({
        email: 'repetida@omnitravel.test',
        password: CONTRASENA,
      }),
    );

    expect(error.getStatus()).toBe(409);
    expect(codigo(error)).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rechaza una contraseña que no cumple la política', async () => {
    const { servicio, usuarios } = crearServicio();
    const error = await capturar(
      servicio.registrar({
        email: 'debil@omnitravel.test',
        password: 'corta',
      }),
    );

    expect(error.getStatus()).toBe(400);
    expect(codigo(error)).toBe('VALIDATION_ERROR');
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('responde 500 si el rol solicitado no existe en la BD', async () => {
    const { servicio } = crearServicio({ rol: null });
    const error = await capturar(
      servicio.registrar({
        email: 'sinrol@omnitravel.test',
        password: CONTRASENA,
      }),
    );

    expect(error.getStatus()).toBe(500);
    expect(codigo(error)).toBe('INTERNAL_ERROR');
  });
});

describe('AuthService — auditoría de eventos de cuenta', () => {
  const eventos = (usuarios: { manager: { query: jest.Mock } }) =>
    usuarios.manager.query.mock.calls.map(([, params]: [string, unknown[]]) => [
      params[0],
      params[1],
      JSON.parse(params[2] as string),
    ]);

  function conUsuario(
    usuarios: { createQueryBuilder: jest.Mock },
    usuario: Record<string, unknown> | null,
  ) {
    const consulta = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(usuario),
    };
    usuarios.createQueryBuilder.mockReturnValue(consulta);
  }

  const bcrypt = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');
  const hash = bcrypt.hashSync(CONTRASENA, 4);

  it('registra el rol asignado al crear la cuenta', async () => {
    const { servicio, usuarios } = crearServicio();
    await servicio.registrar({ email: 'ana@correo.co', password: CONTRASENA });
    expect(eventos(usuarios)).toEqual([
      ['42', 'registro_cuenta', { rol: 'viajero' }],
    ]);
  });

  it('registra el inicio de sesión exitoso sin guardar el correo', async () => {
    const { servicio, usuarios } = crearServicio();
    conUsuario(usuarios, {
      id: '7',
      email: 'ana@correo.co',
      passwordHash: hash,
      estadoCuenta: 'activo',
      rolId: '1',
    });
    await servicio.iniciarSesion({
      email: 'ana@correo.co',
      password: CONTRASENA,
    });
    expect(eventos(usuarios)).toEqual([
      ['7', 'inicio_sesion', { rol: 'viajero' }],
    ]);
    expect(JSON.stringify(usuarios.manager.query.mock.calls)).not.toContain(
      'ana@correo.co',
    );
  });

  it('registra el intento fallido de una cuenta existente', async () => {
    const { servicio, usuarios } = crearServicio();
    conUsuario(usuarios, {
      id: '7',
      email: 'ana@correo.co',
      passwordHash: hash,
      estadoCuenta: 'activo',
      rolId: '1',
    });
    const error = await capturar(
      servicio.iniciarSesion({ email: 'ana@correo.co', password: 'Otra123!' }),
    );
    expect(codigo(error)).toBe('INVALID_CREDENTIALS');
    expect(eventos(usuarios)).toEqual([
      ['7', 'inicio_sesion_fallido', { motivo: 'contrasena_incorrecta' }],
    ]);
  });

  it('no audita correos que no existen (no revela cuentas)', async () => {
    const { servicio, usuarios } = crearServicio();
    conUsuario(usuarios, null);
    await capturar(
      servicio.iniciarSesion({
        email: 'nadie@correo.co',
        password: CONTRASENA,
      }),
    );
    expect(usuarios.manager.query).not.toHaveBeenCalled();
  });

  it('si la auditoría falla, el inicio de sesión continúa', async () => {
    const { servicio, usuarios } = crearServicio();
    usuarios.manager.query.mockRejectedValue(new Error('sin tabla'));
    conUsuario(usuarios, {
      id: '7',
      email: 'ana@correo.co',
      passwordHash: hash,
      estadoCuenta: 'activo',
      rolId: '1',
    });
    await expect(
      servicio.iniciarSesion({ email: 'ana@correo.co', password: CONTRASENA }),
    ).resolves.toMatchObject({ token: 'jwt' });
  });
});
