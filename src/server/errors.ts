/**
 * Error de negocio con mensaje apto para mostrar al usuario. Todo lo que no sea
 * DomainError se considera inesperado y se muestra con un mensaje genérico.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function userMessage(error: unknown, fallback = "Algo salió mal. Probá de nuevo."): string {
  return error instanceof DomainError ? error.message : fallback;
}
