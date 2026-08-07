import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error';

interface ErrorBody {
  status: number;
  message: string;
  stack?: string;
}

/**
 * Single exception filter for the whole service: every error leaves as
 * `{ status, message }`. Stack traces are attached in development only;
 * unknown errors are logged in full but sanitized on the wire.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isDev: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = 500;
    let message = 'Internal server error';

    if (exception instanceof AppError) {
      status = exception.status;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const m = (body as { message: string | string[] }).message;
        message = Array.isArray(m) ? m.join('; ') : m;
      } else {
        message = exception.message;
      }
    } else {
      this.logger.error(
        `unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const payload: ErrorBody = { status, message };
    if (this.isDev && exception instanceof Error && exception.stack) {
      payload.stack = exception.stack;
    }
    res.status(status).json(payload);
  }
}
