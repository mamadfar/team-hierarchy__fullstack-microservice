/**
 * Operational error carrying an HTTP status. Thrown anywhere in the service
 * and rendered by the global exception filter as `{ status, message }`.
 */
export class AppError extends Error {
  readonly isOperational = true;

  constructor(
    readonly status: number,
    message: string,
    /** Optional structured detail (e.g. per-row parse errors) — logged/stored, never leaked raw to clients. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
