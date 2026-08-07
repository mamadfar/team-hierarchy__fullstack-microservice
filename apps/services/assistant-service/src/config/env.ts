import { z } from 'zod';

/** DI token for the validated environment. */
export const ENV = Symbol('ENV');

/** Treat empty strings as "unset" so `FOO=` in .env behaves like a missing var. */
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
);

export const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (postgres connection string)'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required (redis connection string)'),
    /** Optional on purpose: the service must boot (and answer via the deterministic fallback) without it. */
    ANTHROPIC_API_KEY: optionalString,
    LLM_MODEL: z.string().min(1).default('claude-haiku-4-5'),
    EMBEDDING_PROVIDER: z.enum(['mock', 'voyage', 'openai']).default('mock'),
    EMBEDDING_MODEL: z.string().min(1).default('voyage-3-lite'),
    EMBEDDING_API_KEY: optionalString,
    ASSISTANT_PORT: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().positive().default(4002),
    ),
    WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    NODE_ENV: z.string().default('development'),
  })
  .superRefine((env, ctx) => {
    if (env.EMBEDDING_PROVIDER !== 'mock' && !env.EMBEDDING_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMBEDDING_API_KEY'],
        message: `EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER="${env.EMBEDDING_PROVIDER}" (only "mock" runs without a key)`,
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse and validate process.env. Called once at boot — crashes fast with a
 * readable message naming every offending variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`[assistant-service] invalid environment:\n${details}`);
    throw new Error('assistant-service: environment validation failed, see log above');
  }
  return parsed.data;
}
