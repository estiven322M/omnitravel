import { Column, Entity, PrimaryColumn } from 'typeorm';

// Mapea la tabla existente `rol` (viajero, colaborador, establecimiento,
// moderador, administrador).
@Entity({ name: 'rol' })
export class Rol {
  @PrimaryColumn({ name: 'id_rol', type: 'bigint' })
  id: string;

  @Column({ name: 'nombre_rol', type: 'text' })
  nombre: string;
}
