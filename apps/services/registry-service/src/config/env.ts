import { z } from 'zod';

/** Nest injection token for the validated environment object. */
export const ENV = Symbol('ORBIT_REGISTRY_ENV');

const BoolFromString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return value; // let z.boolean() produce a clear error
}, z.boolean());

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().min(1).default('postgres://orbit:orbit@localhost:5433/orbit'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6380'),

    CONFLUENCE_BASE_URL: z.string().default(''),
    CONFLUENCE_EMAIL: z.string().default(''),
    CONFLUENCE_API_TOKEN: z.string().default(''),
    /** Comma-separated page ids; order = display order. */
    CONFLUENCE_PAGE_IDS: z.string().default(''),
    MOCK_CONFLUENCE: BoolFromString.default(true),

    /** Optional cron expression; empty/unset = no scheduled sync. */
    SYNC_CRON: z.string().optional(),
    SYNC_APP_TOKEN: z.string().min(1).default('dev-sync-token'),

    GROUP_NAME: z.string().min(1).default('Aurora Group'),
    GROUP_ICON: z.string().min(1).default('globe'),
    GROUP_HUE: z.coerce.number().int().min(0).max(360).default(262),

    REGISTRY_PORT: z.coerce.number().int().min(0).max(65535).default(4001),
    WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_CONFLUENCE) {
      const required = [
        'CONFLUENCE_BASE_URL',
        'CONFLUENCE_EMAIL',
        'CONFLUENCE_API_TOKEN',
        'CONFLUENCE_PAGE_IDS',
      ] as const;
      for (const key of required) {
        if (!env[key].trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when MOCK_CONFLUENCE=false`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates the process environment. Empty-string values are treated as unset
 * (matches the `.env.example` style `SYNC_CRON=`), so defaults still apply.
 * Throws with a readable multi-line message — the service must crash fast.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`[registry-service] Invalid environment configuration:\n${detail}`);
  }
  return result.data;
}

/** CONFLUENCE_PAGE_IDS as a trimmed, non-empty list (display order preserved). */
export function confluencePageIds(env: Env): string[] {
  return env.CONFLUENCE_PAGE_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
