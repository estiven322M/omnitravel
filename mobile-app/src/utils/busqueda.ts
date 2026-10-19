import type { Poi } from '../services/types';

/** Minúsculas y sin tildes: «Quindío» y «quindio» coinciden. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

type PoiBuscable = Pick<Poi, 'nombre' | 'categoria' | 'direccion'>;

/**
 * ¿El lugar coincide con lo escrito? Cada palabra debe aparecer (como parte
 * de una palabra) en el nombre, la categoría o la dirección, en cualquier
 * orden: «oro museo», «muse» o «fonda paisa» encuentran sus lugares.
 */
export function coincideBusqueda(poi: PoiBuscable, texto: string): boolean {
  const palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) {
    return true;
  }
  const pajar = normalizarTexto(
    `${poi.nombre} ${poi.categoria} ${poi.direccion}`,
  );
  return palabras.every((palabra) => pajar.includes(palabra));
}

/** Relevancia: el nombre empieza por lo escrito > lo contiene > otro campo. */
function puntaje(poi: PoiBuscable, texto: string): number {
  const nombre = normalizarTexto(poi.nombre);
  const buscado = normalizarTexto(texto);
  if (nombre.startsWith(buscado)) {
    return 0;
  }
  if (nombre.split(/\s+/).some((parte) => parte.startsWith(buscado))) {
    return 1;
  }
  return nombre.includes(buscado) ? 2 : 3;
}

/** Sugerencias mientras se escribe: coincidencias ordenadas por relevancia. */
export function sugerenciasDeBusqueda<T extends PoiBuscable>(
  pois: T[],
  texto: string,
  limite = 6,
): T[] {
  if (normalizarTexto(texto) === '') {
    return [];
  }
  return pois
    .filter((poi) => coincideBusqueda(poi, texto))
    .map((poi, indice) => ({ poi, indice, puntaje: puntaje(poi, texto) }))
    .sort(
      (a, b) =>
        a.puntaje - b.puntaje ||
        a.poi.nombre.localeCompare(b.poi.nombre, 'es') ||
        a.indice - b.indice,
    )
    .slice(0, limite)
    .map(({ poi }) => poi);
}
