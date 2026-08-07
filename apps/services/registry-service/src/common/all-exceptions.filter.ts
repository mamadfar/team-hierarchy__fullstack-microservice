import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { ENV, Env } from '../config/env';
import { AppError } from './app-error';
import { formatZodError } from './zod-error';

interface ErrorBody {
  status: number;
  message: string;
  stack?: string;
}

/**
 * Single global exception filter: every error becomes `{ status, message }`.
 * Stack traces are attached only when NODE_ENV=development. 5xx are logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = 500;
    let message = 'Internal server error';

    if (exception instanceof AppError) {
      status = exception.status;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = this.httpExceptionMessage(exception);
    } else if (exception instanceof ZodError) {
      status = 400;
      message = `Validation failed: ${formatZodError(exception)}`;
    }

    const body: ErrorBody = { status, message };
    if (this.env.NODE_ENV === 'development' && exception instanceof Error && exception.stack) {
      body.stack = exception.stack;
    }

    if (status >= 500) {
      this.logger.error(
        `Unhandled ${status}: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private httpExceptionMessage(exception: HttpException): string {
    const payload = exception.getResponse();
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const m = (payload as { message: unknown }).message;
      if (Array.isArray(m)) return m.join('; ');
      if (typeof m === 'string') return m;
    }
    return exception.message;
  }
}
