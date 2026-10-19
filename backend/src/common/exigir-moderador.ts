import { HttpStatus } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { errorDominio } from './errores';

/**
 * RNF-09: el rol se consulta en la BD en cada operación de moderación; no se
 * confía en el token ni en el cliente.
 */
export async function exigirModerador(
  db: DataSource | EntityManager,
  usuarioId: string,
): Promise<void> {
  const filas: unknown[] = await db.query(
    `select 1 from usuario u join rol r on r.id_rol = u.rol_id
      where u.id_usuario = $1 and u.estado_cuenta = 'activo'
        and r.nombre_rol in ('moderador', 'administrador')`,
    [usuarioId],
  );
  if (filas.length === 0) {
    throw errorDominio(
      HttpStatus.FORBIDDEN,
      'ACCESO_DENEGADO',
      'Solo moderación puede hacer esto.',
    );
  }
}
