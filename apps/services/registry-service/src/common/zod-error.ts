import { ZodError } from 'zod';

/** "path: message; path: message" — compact single-line rendering of a ZodError. */
export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
