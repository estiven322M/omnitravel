import { render, screen } from '@testing-library/react-native';
import { ToggleRow } from '../components/ToggleRow';

describe('ToggleRow', () => {
  it('anuncia «Desactivado» desde el primer foco cuando está apagado', async () => {
    await render(
      <ToggleRow etiqueta="Rampa" valor={false} onCambio={() => {}} />,
    );
    const interruptor = screen.getByRole('switch', { name: 'Rampa' });
    expect(interruptor.props.accessibilityValue).toEqual({
      text: 'Desactivado',
    });
    expect(interruptor).not.toBeChecked();
  });

  it('anuncia «Activado» y queda marcado cuando está encendido', async () => {
    await render(<ToggleRow etiqueta="Rampa" valor onCambio={() => {}} />);
    const interruptor = screen.getByRole('switch', { name: 'Rampa' });
    expect(interruptor.props.accessibilityValue).toEqual({ text: 'Activado' });
    expect(interruptor).toBeChecked();
  });
});
