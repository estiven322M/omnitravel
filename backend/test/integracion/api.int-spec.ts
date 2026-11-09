/**
 * Pruebas de INTEGRACIÓN (auditoría NC-06).
 *
 * A diferencia de las unitarias (servicios con la BD simulada), aquí se
 * levanta la aplicación NestJS completa con la misma configuración HTTP de
 * producción (`configurarApp`: helmet, CORS, validación) contra una base
 * PostgreSQL + PostGIS real creada con las migraciones del proyecto, y un
 * Valhalla local que responde como el real. Cada prueba recorre varias capas:
 * controlador → guardas JWT → servicio → SQL/PostGIS → respuesta HTTP.
 *
 * Requiere INTEGRACION_DATABASE_URL (una base desechable: se borra entera).
 *   npm run test:integracion
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/config/configurar-app';
import {
  consultar,
  crearLugar,
  MODERADOR,
  prepararBaseDeDatos,
} from './base-de-datos';
import { ValhallaFalso } from './valhalla-falso';

const URL_BD = process.env.INTEGRACION_DATABASE_URL ?? '';
const CLAVE = 'Viajera123!';
/** JPEG mínimo válido (firma FF D8) para la foto de evidencia. */
const FOTO_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
]);

const describirSiHayBd = URL_BD ? describe : describe.skip;

describirSiHayBd('Integración — API + PostgreSQL/PostGIS + Valhalla', () => {
  let app: NestExpressApplication;
  let http: App;
  const valhalla = new ValhallaFalso();
  const tokens: Record<string, string> = {};
  let lugarId: number;

  const registrar = async (alias: string) => {
    const res = await request(http)
      .post('/auth/register')
      .send({ email: `${alias}@integracion.test`, password: CLAVE })
      .expect(201);
    tokens[alias] = res.body.token as string;
    return res.body as {
      token: string;
      usuario: { id_usuario: number; rol: string };
    };
  };
  const conToken = (alias: string) => ({
    Authorization: `Bearer ${tokens[alias]}`,
  });

  beforeAll(async () => {
    await prepararBaseDeDatos(URL_BD);
    Object.assign(process.env, {
      DATABASE_URL: URL_BD,
      DB_SSL: 'false',
      JWT_SECRET: 'integracion-'.padEnd(48, 'x'),
      NODE_ENV: 'production',
      EVIDENCIAS_DIR: mkdtempSync(join(tmpdir(), 'omnitravel-evidencias-')),
      VALHALLA_URL: await valhalla.iniciar(),
    });
    delete process.env.EVIDENCIAS_BUCKET;

    // El entorno se fija antes de crear el módulo: TypeORM y los servicios
    // leen DATABASE_URL, VALHALLA_URL… al inicializarse, como en el arranque real.
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();
    http = app.getHttpServer() as App;
    lugarId = await crearLugar(URL_BD, 'Museo de Integración');
  });

  afterAll(async () => {
    await app?.close();
    await valhalla.detener();
  });

  describe('Plataforma y seguridad', () => {
    it('CP-I01 /health responde con cabeceras de seguridad (helmet)', async () => {
      const res = await request(http).get('/health').expect(200);
      expect(res.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('CP-I02 Swagger no se publica en producción', async () => {
      await request(http).get('/api/docs').expect(404);
    });

    it('CP-I03 las entradas inválidas se rechazan antes de tocar la base', async () => {
      await registrar('ana');
      const res = await request(http)
        .post('/reportes')
        .set(conToken('ana'))
        .send({
          nombre: 'Lugar fuera del mapa',
          tipoPoi: 'parque',
          lat: 200,
          lon: -75.6,
        })
        .expect(400);
      expect(res.body.error).toBe('COORDENADAS_INVALIDAS');
      const [{ total }] = await consultar<{ total: number }>(
        URL_BD,
        `select count(*)::int as total from poi where nombre = 'Lugar fuera del mapa'`,
      );
      expect(total).toBe(0);
    });
  });

  describe('Autenticación + auditoría (RNF-21, 6.7 ítem 9)', () => {
    it('CP-I04 registro, inicio de sesión y fallo quedan en registro_auditoria', async () => {
      const { usuario } = await registrar('beto');
      await request(http)
        .post('/auth/login')
        .send({ email: 'beto@integracion.test', password: CLAVE })
        .expect(200);
      await request(http)
        .post('/auth/login')
        .send({ email: 'beto@integracion.test', password: 'Incorrecta1!' })
        .expect(401);

      const eventos = await consultar<{
        accion: string;
        detalle: Record<string, string>;
      }>(
        URL_BD,
        'select accion, detalle from registro_auditoria where usuario_id = $1 order by id_auditoria',
        [usuario.id_usuario],
      );
      expect(eventos.map((e) => e.accion)).toEqual([
        'registro_cuenta',
        'inicio_sesion',
        'inicio_sesion_fallido',
      ]);
      expect(JSON.stringify(eventos)).not.toContain('@');
    });

    it('CP-I05 un token falsificado no da acceso', async () => {
      await request(http)
        .get('/reportes/mios')
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma',
        )
        .expect(401);
    });
  });

  describe('Proceso 1 — reporte, consenso de 3 y publicación en el mapa', () => {
    let reporteId: number;

    it('CP-I06 el reporte con foto queda pendiente y la foto en el almacenamiento', async () => {
      await registrar('autora');
      const subida = await request(http)
        .post('/evidencias')
        .set(conToken('autora'))
        .send({ base64: FOTO_JPEG.toString('base64'), mimeType: 'image/jpeg' })
        .expect(201);
      const res = await request(http)
        .post('/reportes')
        .set(conToken('autora'))
        .send({
          poiId: lugarId,
          descripcion: 'Rampa nueva en la entrada principal',
          caracteristicas: [
            { caracteristicaId: 1, valorBooleano: true },
            { caracteristicaId: 7, valorNumerico: 95 },
          ],
          evidenciaStorageKey: subida.body.storageKey,
        })
        .expect(201);
      expect(res.body.estado).toBe('pendiente_validacion');
      reporteId = Number(res.body.id_reporte);
    });

    it('CP-I07 la autora no puede confirmar su propio reporte (RNF-29)', async () => {
      const res = await request(http)
        .post(`/reportes/${reporteId}/confirmaciones`)
        .set(conToken('autora'))
        .expect(422);
      expect(res.body.error).toBe('AUTOCONFIRMACION');
    });

    it('CP-I08 la tercera confirmación publica y actualiza los valores del lugar', async () => {
      for (const alias of ['c1', 'c2', 'c3']) {
        await registrar(alias);
      }
      await request(http)
        .post(`/reportes/${reporteId}/confirmaciones`)
        .set(conToken('c1'))
        .expect(201);
      await request(http)
        .post(`/reportes/${reporteId}/confirmaciones`)
        .set(conToken('c2'))
        .expect(201);
      const tercera = await request(http)
        .post(`/reportes/${reporteId}/confirmaciones`)
        .set(conToken('c3'))
        .expect(201);
      expect(tercera.body).toEqual({ confirmaciones: 3, publicado: true });

      const valores = await consultar<{
        caracteristica_id: number;
        valor_booleano: boolean;
        valor_numerico: string;
      }>(
        URL_BD,
        `select caracteristica_id::int, valor_booleano, valor_numerico
           from valor_accesibilidad_poi where poi_id = $1 order by caracteristica_id`,
        [lugarId],
      );
      expect(valores).toEqual([
        expect.objectContaining({ caracteristica_id: 1, valor_booleano: true }),
        expect.objectContaining({ caracteristica_id: 7, valor_numerico: '95' }),
      ]);
    });

    it('CP-I09 una persona no confirma dos veces (servicio + índice único 004)', async () => {
      const res = await request(http)
        .post(`/reportes/${reporteId}/confirmaciones`)
        .set(conToken('c1'));
      expect(res.status).toBeGreaterThanOrEqual(400);
      const [{ total }] = await consultar<{ total: number }>(
        URL_BD,
        'select count(*)::int as total from confirmacion where reporte_id = $1',
        [reporteId],
      );
      expect(total).toBe(3);
    });

    it('CP-I10 el mapa entrega el lugar con su ubicación PostGIS en GeoJSON', async () => {
      const res = await request(http).get('/mapa').expect(200);
      const lugar = (
        res.body.pois as {
          id_poi: number;
          ubicacion: { type: string; coordinates: number[] };
        }[]
      ).find((p) => p.id_poi === lugarId);
      expect(lugar?.ubicacion).toEqual({
        type: 'Point',
        coordinates: [-75.6727, 4.5339],
      });
    });

    it('CP-I11 la consulta unificada GET /reportes pagina desde la base', async () => {
      const res = await request(http)
        .get('/reportes?page=1&limit=5')
        .set(conToken('ana'))
        .expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
      expect(
        res.body.data.some(
          (r: { id_reporte: string }) => Number(r.id_reporte) === reporteId,
        ),
      ).toBe(true);
    });
  });

  describe('Moderación — fotos de evidencia con permiso temporal', () => {
    it('CP-I12 sin firma la foto no se entrega; con la firma del listado, sí', async () => {
      const login = await request(http)
        .post('/auth/login')
        .send(MODERADOR)
        .expect(200);
      tokens.moderador = login.body.token as string;
      const lista = await request(http)
        .get('/moderacion/reportes')
        .set(conToken('moderador'))
        .expect(200);
      const foto = (
        lista.body as { evidencia: { storage_key: string; acceso: string }[] }[]
      )
        .flatMap((r) => r.evidencia)
        .find((e) => e.storage_key);
      expect(foto?.acceso).toMatch(/^exp=\d+&firma=/);

      await request(http)
        .get(`/evidencias/archivo/${foto!.storage_key}`)
        .expect(403);
      const ok = await request(http)
        .get(`/evidencias/archivo/${foto!.storage_key}?${foto!.acceso}`)
        .expect(200);
      expect(Buffer.from(ok.body as Buffer).subarray(0, 2)).toEqual(
        Buffer.from([0xff, 0xd8]),
      );
    });

    it('CP-I13 un viajero no accede a la consola de moderación (RNF-23)', async () => {
      await request(http)
        .get('/moderacion/reportes')
        .set(conToken('ana'))
        .expect(403);
    });
  });

  describe('Proceso 2 — rutas accesibles con Valhalla', () => {
    const cuerpo = {
      origin: [4.5339, -75.6811],
      destination: [4.537, -75.672],
      restrictions: { perfil: 'silla_de_ruedas', avoidStairs: true },
    };

    it('CP-I14 envía el perfil peatonal en silla de ruedas y normaliza la ruta', async () => {
      valhalla.responder(200);
      const res = await request(http)
        .post('/routes')
        .set(conToken('ana'))
        .send(cuerpo)
        .expect(201);
      expect(res.body).toMatchObject({
        distanciaKm: 1.25,
        duracionMin: 15,
        perfil: 'silla_de_ruedas',
      });
      expect(valhalla.solicitudes[0]).toMatchObject({
        costing: 'pedestrian',
        costing_options: {
          pedestrian: expect.objectContaining({ type: 'wheelchair' }),
        },
      });
    });

    it('CP-I15 reintenta si Valhalla falla una vez (riesgo 4)', async () => {
      valhalla.responder(503, 200);
      await request(http)
        .post('/routes')
        .set(conToken('ana'))
        .send(cuerpo)
        .expect(201);
      expect(valhalla.solicitudes).toHaveLength(2);
    });

    it('CP-I16 si Valhalla no se recupera responde 503 con mensaje de contingencia', async () => {
      valhalla.responder(500, 500, 500);
      const res = await request(http)
        .post('/routes')
        .set(conToken('ana'))
        .send(cuerpo)
        .expect(503);
      expect(res.body.error).toBe('RUTEO_NO_DISPONIBLE');
    });
  });

  describe('Proceso 3 — visita, experiencia, incidencia y cierre del ciclo', () => {
    let visitaId: number;

    it('CP-I17 una visita completada con calificación baja abre incidencia y re-verificación', async () => {
      const visita = await request(http)
        .post('/visitas')
        .set(conToken('ana'))
        .send({ poi_id: lugarId })
        .expect(201);
      visitaId = visita.body.visita.id_visita as number;
      await request(http)
        .post(`/visitas/${visitaId}/finalizar`)
        .set(conToken('ana'))
        .expect(200);

      const res = await request(http)
        .post('/experiences')
        .set(conToken('ana'))
        .send({
          visita_id: visitaId,
          calificacion: 2,
          discrepancia: true,
          tipo_incidencia: 'barrera',
          descripcion_incidencia: 'La rampa está bloqueada por obras',
        })
        .expect(201);
      expect(res.body.incidencia).toEqual(
        expect.objectContaining({ estado: 'abierta' }),
      );

      const [lugar] = await consultar<{ estado: string }>(
        URL_BD,
        'select estado from poi where id_poi = $1',
        [lugarId],
      );
      expect(lugar.estado).toBe('en_revision');
    });

    it('CP-I18 no se califica dos veces la misma visita (índice único parcial)', async () => {
      const res = await request(http)
        .post('/experiences')
        .set(conToken('ana'))
        .send({ visita_id: visitaId, calificacion: 4 })
        .expect(409);
      expect(res.body.error).toBe('VISITA_YA_CALIFICADA');
    });

    it('CP-I19 al aprobar la re-verificación el lugar vuelve a publicarse y se cierra la solicitud', async () => {
      const [{ id }] = await consultar<{ id: number }>(
        URL_BD,
        `select id_reporte::int as id from reporte
          where poi_id = $1 and tipo = 'reverificacion' and estado = 'pendiente_validacion'`,
        [lugarId],
      );
      await request(http)
        .post(`/moderacion/reportes/${id}/decision`)
        .set(conToken('moderador'))
        .send({ accion: 'aprobado' })
        .expect(201);

      const [estado] = await consultar<{
        poi: string;
        solicitud: string;
        incidencia: string;
      }>(
        URL_BD,
        `select p.estado as poi, s.estado as solicitud, i.estado as incidencia
           from poi p
           join retroalimentacion r on r.poi_id = p.id_poi
           join incidencia i on i.retroalimentacion_id = r.id_retroalimentacion
           join solicitud_reverificacion s on s.incidencia_id = i.id_incidencia
          where p.id_poi = $1`,
        [lugarId],
      );
      expect(estado).toEqual({
        poi: 'publicado',
        solicitud: 'resuelta',
        incidencia: 'resuelta',
      });
    });

    it('CP-I20 las estadísticas del moderador reflejan lo ocurrido en la base', async () => {
      const res = await request(http)
        .get('/moderacion/estadisticas')
        .set(conToken('moderador'))
        .expect(200);
      expect(res.body.experiencias).toMatchObject({ total: 1 });
    });
  });
});
