/** Fecha (AAAA-MM-DD) en hora de Colombia. */
function fechaColombia(instante: Date): string {
  return instante.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * ¿La fecha ISO cae «hoy» en Colombia? Es el mismo criterio del contador
 * «Puntos verificados hoy» del panel del moderador.
 */
export function esDeHoyEnColombia(
  fechaIso: string | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!fechaIso) {
    return false;
  }
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) {
    return false;
  }
  return fechaColombia(fecha) === fechaColombia(ahora);
}
