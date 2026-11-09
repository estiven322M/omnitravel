import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Respuesta mínima con la forma real de Valhalla (`/route`). */
export const RUTA_VALHALLA = {
  trip: {
    summary: { length: 1.25, time: 900 },
    legs: [
      {
        shape: 'abc123',
        maneuvers: [
          {
            type: 1,
            instruction: 'Camine hacia el norte por la Carrera 14.',
            length: 0.8,
          },
          { type: 4, instruction: 'Llegó a su destino.', length: 0 },
        ],
      },
    ],
  },
};

/**
 * Servidor HTTP local que hace de Valhalla. Responde en orden los códigos de
 * `programa` (p. ej. [503, 200]) y guarda cada solicitud recibida, para
 * verificar el contrato que envía el backend y su política de reintentos.
 */
export class ValhallaFalso {
  readonly solicitudes: Record<string, unknown>[] = [];
  private programa: number[] = [];
  private servidor?: Server;

  responder(...codigos: number[]) {
    this.programa = codigos;
    this.solicitudes.length = 0;
  }

  async iniciar(): Promise<string> {
    this.servidor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (parte: Buffer) => (cuerpo += parte.toString()));
      req.on('end', () => {
        this.solicitudes.push(
          JSON.parse(cuerpo || '{}') as Record<string, unknown>,
        );
        const codigo = this.programa.shift() ?? 200;
        res.writeHead(codigo, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            codigo === 200 ? RUTA_VALHALLA : { error: 'falla simulada' },
          ),
        );
      });
    });
    await new Promise<void>((listo) =>
      this.servidor!.listen(0, '127.0.0.1', listo),
    );
    const { port } = this.servidor.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async detener(): Promise<void> {
    await new Promise<void>((listo) => this.servidor?.close(() => listo()));
  }
}
