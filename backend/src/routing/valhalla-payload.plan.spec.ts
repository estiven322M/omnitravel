import { construirSolicitudValhalla, type Coordenada } from './valhalla-payload';

/**
 * Plan de pruebas — Proceso 2: Planificación de Rutas Accesibles.
 * Cada `it` lleva el ID de su caso en TestRail (CP-010 a CP-016). Los casos
 * CP-017 a CP-019 (distancias) están en mobile-app/src/__tests__/geo.plan.test.ts,
 * porque la función de distancia vive en la app.
 *
 * Nota: el motor no aplica hoy penalización por pendientes; el filtro de
 * impedancias se prueba con lo implementado (escaleras, ascensores y tipo
 * de perfil de Valhalla).
 */

/** Plaza de Bolívar → Museo del Oro Quimbaya (Armenia). */
const origen: Coordenada = [4.5339, -75.6811];
const destino: Coordenada = [4.5534, -75.6586];

describe('Proceso 2 · Formateo de parámetros hacia Valhalla', () => {
  it('CP-010 arma el payload básico con origen y destino en formato {lat, lon}', () => {
    const { solicitud } = construirSolicitudValhalla(origen, destino);

    expect(solicitud.locations).toEqual([
      { lat: 4.5339, lon: -75.6811 },
      { lat: 4.5534, lon: -75.6586 },
    ]);
  });

  it('CP-011 usa costing peatonal por defecto (km, es-ES, sin opciones extra)', () => {
    const { solicitud, advertencias } = construirSolicitudValhalla(origen, destino);

    expect(solicitud.costing).toBe('pedestrian');
    expect(solicitud.units).toBe('kilometers');
    expect(solicitud.language).toBe('es-ES');
    expect(solicitud.costing_options).toEqual({ pedestrian: {} });
    expect(advertencias).toEqual([]);
  });

  it('CP-012 propaga las opciones de costing cuando se envía un perfil', () => {
    const { solicitud } = construirSolicitudValhalla(origen, destino, {
      perfil: 'silla_de_ruedas',
      avoidStairs: true,
      requireElevator: true,
    });

    expect(solicitud.costing).toBe('pedestrian');
    expect(solicitud.costing_options.pedestrian).toEqual({
      type: 'wheelchair',
      step_penalty: 3600,
      elevator_penalty: 0,
    });
  });
});

describe('Proceso 2 · Filtro de impedancias por perfil de movilidad', () => {
  it('CP-013 el perfil silla de ruedas penaliza las escaleras', () => {
    const { solicitud } = construirSolicitudValhalla(origen, destino, {
      perfil: 'silla_de_ruedas',
      avoidStairs: true,
    });
    const opciones = solicitud.costing_options.pedestrian;

    expect(opciones.type).toBe('wheelchair');
    // 3600 s por tramo de escaleras: la ruta las evita si hay alternativa.
    expect(opciones.step_penalty).toBe(3600);
  });

  it('CP-014 el perfil peatonal estándar no penaliza escaleras', () => {
    const { solicitud } = construirSolicitudValhalla(origen, destino, {
      perfil: 'peatonal',
    });
    const opciones = solicitud.costing_options.pedestrian;

    expect(opciones).not.toHaveProperty('type');
    expect(opciones).not.toHaveProperty('step_penalty');
  });

  it('CP-015 el perfil motriz que requiere ascensor deja de penalizarlos', () => {
    const { solicitud } = construirSolicitudValhalla(origen, destino, {
      perfil: 'silla_de_ruedas',
      requireElevator: true,
    });

    expect(solicitud.costing_options.pedestrian.elevator_penalty).toBe(0);
  });

  it('CP-016 el perfil sensorial (visual) no aplica impedancias de movilidad física', () => {
    const { solicitud } = construirSolicitudValhalla(origen, destino, {
      perfil: 'visual',
    });
    const opciones = solicitud.costing_options.pedestrian;

    expect(opciones.type).toBe('blind');
    expect(opciones).not.toHaveProperty('step_penalty');
    expect(opciones).not.toHaveProperty('elevator_penalty');
  });
});
