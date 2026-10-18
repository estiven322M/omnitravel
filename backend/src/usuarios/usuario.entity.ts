import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mapea la tabla existente `usuario`. synchronize está desactivado,
// así que esta clase solo describe la tabla, no la modifica.
@Entity({ name: 'usuario' })
export class Usuario {
  @PrimaryGeneratedColumn('identity', {
    name: 'id_usuario',
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash: string;

  @Column({ name: 'rol_id', type: 'bigint' })
  rolId: string;

  @Column({ name: 'fecha_registro', type: 'timestamptz', insert: false })
  fechaRegistro: Date;

  @Column({ name: 'estado_cuenta', type: 'text', insert: false })
  estadoCuenta: 'activo' | 'suspendido' | 'eliminado';
}
