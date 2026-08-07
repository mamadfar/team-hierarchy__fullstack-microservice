import { z } from 'zod';

/**
 * Env contract for the web app (names fixed by the root .env.example).
 *
 * - Client env (NEXT_PUBLIC_*) is inlined at build time, so every variable is
 *   referenced statically below. Validated eagerly at module load — an invalid
 *   value crashes the build/boot with a clear message.
 * - Server env (SYNC_APP_TOKEN, REGISTRY_API_URL) is only read inside route
 *   handlers via getServerEnv() and never reaches the client bundle.
 */

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const clientSchema = z.object({
  NEXT_PUBLIC_REGISTRY_API_URL: z.preprocess(
    emptyToUndef,
    z.string().url().default('http://localhost:4001'),
  ),
  NEXT_PUBLIC_ASSISTANT_API_URL: z.preprocess(
    emptyToUndef,
    z.string().url().default('http://localhost:4002'),
  ),
  /** Template with a {queueKey} placeholder; empty/unset disables deep-linking. */
  NEXT_PUBLIC_TICKET_URL_TEMPLATE: z.preprocess(emptyToUndef, z.string().min(1).optional()),
});

const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_REGISTRY_API_URL: process.env.NEXT_PUBLIC_REGISTRY_API_URL,
  NEXT_PUBLIC_ASSISTANT_API_URL: process.env.NEXT_PUBLIC_ASSISTANT_API_URL,
  NEXT_PUBLIC_TICKET_URL_TEMPLATE: process.env.NEXT_PUBLIC_TICKET_URL_TEMPLATE,
});

if (!clientParsed.success) {
  throw new Error(
    `[orbit/web] Invalid NEXT_PUBLIC_* environment:\n${clientParsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  );
}

export const clientEnv = {
  registryApiUrl: clientParsed.data.NEXT_PUBLIC_REGISTRY_API_URL.replace(/\/$/, ''),
  assistantApiUrl: clientParsed.data.NEXT_PUBLIC_ASSISTANT_API_URL.replace(/\/$/, ''),
  ticketUrlTemplate: clientParsed.data.NEXT_PUBLIC_TICKET_URL_TEMPLATE ?? null,
} as const;

const serverSchema = z.object({
  /** Bearer token forwarded to registry-service POST /sync. Server-only. */
  SYNC_APP_TOKEN: z.preprocess(emptyToUndef, z.string().min(1).default('dev-sync-token')),
  /**
   * Server-side registry base URL (e.g. http://registry:4001 inside docker).
   * Falls back to NEXT_PUBLIC_REGISTRY_API_URL when unset.
   */
  REGISTRY_API_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
});

export interface ServerEnv {
  syncAppToken: string;
  registryApiUrl: string;
}

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse({
    SYNC_APP_TOKEN: process.env.SYNC_APP_TOKEN,
    REGISTRY_API_URL: process.env.REGISTRY_API_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `[orbit/web] Invalid server environment:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  cachedServerEnv = {
    syncAppToken: parsed.data.SYNC_APP_TOKEN,
    registryApiUrl: (parsed.data.REGISTRY_API_URL ?? clientEnv.registryApiUrl).replace(/\/$/, ''),
  };
  return cachedServerEnv;
}
