/**
 * Operational error: expected failure modes we raise on purpose
 * (bad input, upstream not ready, ...). The global exception filter maps it
 * to `{ status, message }`; anything else is a 500 with a generic message.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
