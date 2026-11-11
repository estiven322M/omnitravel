import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Datos del mapa (U06/U08) con la misma forma de filas que la app leía de
 * Supabase, para que sus mapeadores (`mobile-app/src/services/pois.ts`) no
 * cambien. Los ids bigint y los numeric se convierten a number en SQL
 * porque la app los usa como claves numéricas.
 */
/** Vigencia de la copia en memoria de GET /mapa (MAPA_CACHE_MS; 0 = sin copia). */
const VIGENCIA_POR_DEFECTO_MS = 3000;

@Injectable()
export class MapaService {
  constructor(@InjectDataSource() private readonly db: DataSource) { }

  private copia: { hasta: number; datos: Promise<unknown> } | null = null;

  /**
   * RNF-02: con muchas peticiones simultáneas, todas comparten una sola
   * consulta a la base durante unos segundos (en lugar de 7 consultas por
   * petición). Un cambio se ve en el mapa a más tardar en esa vigencia.
   */
  datos() {
    const vigencia = Number(process.env.MAPA_CACHE_MS ?? VIGENCIA_POR_DEFECTO_MS);
    const ahora = Date.now();
    if (vigencia > 0 && this.copia && this.copia.hasta > ahora) {
      return this.copia.datos;
    }
    const datos = this.consultar();
    if (vigencia > 0) {
      this.copia = { hasta: ahora + vigencia, datos };
      // Si la consulta falla, no se guarda el error.
      datos.catch(() => {
        this.copia = null;
      });
    }
    return datos;
  }

  /** Vacía la copia en memoria (la siguiente petición consulta la base). */
  invalidar() {
    this.copia = null;
  }

  private async consultar() {
    const [caracteristicas, pois, valores, retroalimentacion, reportes, confirmaciones] =
      await Promise.all([
        this.db.query(`
          select id_caracteristica::int, nombre, descripcion, tipo_valor, activa
          from caracteristica_accesibilidad
          order by id_caracteristica`),
        this.db.query(`
          select id_poi::int, nombre, descripcion, tipo, direccion,
                 ST_AsGeoJSON(ubicacion)::json as ubicacion,
                 estado, fecha_creacion, fecha_actualizacion
          from poi
          order by id_poi`),
        this.db.query(`
          select id_valor::int, poi_id::int, caracteristica_id::int, valor_texto,
                 valor_numerico::float8 as valor_numerico, valor_booleano,
                 fecha_actualizacion
          from valor_accesibilidad_poi`),
        this.db.query(`
          select id_retroalimentacion::int, usuario_id::int, poi_id::int,
                 calificacion, comentario, fecha
          from retroalimentacion`),
        this.db.query(`
          select id_reporte::int, poi_id::int, tipo, estado
          from reporte`),
        this.db.query(`
          select id_confirmacion::int, reporte_id::int, usuario_id::int, tipo_confirmacion
          from confirmacion`),
      ]);

    return {
      caracteristicas,
      pois,
      valores,
      retroalimentacion,
      reportes,
      confirmaciones,
      fotos: await this.fotos(),
    };
  }

  /**
   * Fotos de referencia de los lugares (migración 003). Si la tabla aún no
   * existe en la base, el mapa sigue funcionando sin ellas.
   */
  private async fotos() {
    try {
      return await this.db.query(`
        select id_foto::int, poi_id::int, url, leyenda, autor, licencia, fuente_url
        from poi_foto
        order by poi_id, orden, id_foto`);
    } catch {
      return [];
    }
  }
}
