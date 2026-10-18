import { render, screen } from '@testing-library/react-native';
import { AccessibilityValueRow } from '../components/AccessibilityValueRow';
import { getCaracteristica } from '../services/mocks/catalog';

describe('AccessibilityValueRow', () => {
  it('muestra "Sí" para un valor booleano verdadero', async () => {
    await render(
      <AccessibilityValueRow
        caracteristica={getCaracteristica('tiene_rampa')!}
        valor={{ caracteristicaId: 'tiene_rampa', valorBooleano: true }}
      />,
    );
    expect(screen.getByText('Sí')).toBeTruthy();
  });

  it('muestra "No" para un valor booleano falso', async () => {
    await render(
      <AccessibilityValueRow
        caracteristica={getCaracteristica('tiene_ascensor')!}
        valor={{ caracteristicaId: 'tiene_ascensor', valorBooleano: false }}
      />,
    );
    expect(screen.getByText('No')).toBeTruthy();
  });

  it('muestra el valor numérico con unidad', async () => {
    await render(
      <AccessibilityValueRow
        caracteristica={getCaracteristica('ancho_puerta')!}
        valor={{ caracteristicaId: 'ancho_puerta', valorNumerico: 90 }}
      />,
    );
    expect(screen.getByText('90 cm')).toBeTruthy();
  });

  it('muestra "Sin información" cuando falta el valor', async () => {
    await render(
      <AccessibilityValueRow
        caracteristica={getCaracteristica('tiene_braille')!}
      />,
    );
    expect(screen.getByText('Sin información')).toBeTruthy();
  });

  it('expone una etiqueta accesible combinada para lectores de pantalla', async () => {
    await render(
      <AccessibilityValueRow
        caracteristica={getCaracteristica('tiene_rampa')!}
        valor={{ caracteristicaId: 'tiene_rampa', valorBooleano: true }}
      />,
    );
    expect(screen.getByLabelText('Rampa de acceso: Sí')).toBeTruthy();
  });
});
