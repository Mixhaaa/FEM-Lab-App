/** Error de validación con un mensaje en español y el campo que lo causó. */
export class FemError extends Error {
  campo?: string;
  constructor(message: string, campo?: string) {
    super(message);
    this.name = 'FemError';
    this.campo = campo;
  }
}
