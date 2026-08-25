import { z } from 'zod';

/**
 * Every environment variable the server reads, validated once at startup.
 *
 * Nothing else in the codebase touches `process.env`. Defaults are chosen so
 * the app runs with no environment at all, which is what the assignment asks
 * for locally.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /** Render assigns this. */
  PORT: z.coerce.number().int().positive().default(3000),
  /** Must be 0.0.0.0 in a container — Render cannot reach localhost. */
  HOST: z.string().default('0.0.0.0'),

  /** Absolute path to the built frontend. Unset means run API-only. */
  WEB_ROOT: z.string().optional(),

  /** Simulated round-trip to the "external" CRM. */
  CRM_LATENCY_MIN_MS: z.coerce.number().int().nonnegative().default(300),
  CRM_LATENCY_MAX_MS: z.coerce.number().int().nonnegative().default(800),

  /** How long a mocked call rings before its outcome lands. */
  RING_MIN_MS: z.coerce.number().int().nonnegative().default(2000),
  RING_MAX_MS: z.coerce.number().int().nonnegative().default(6000),
});

/** The validated environment. */
export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses and validates the environment.
 *
 * Throws rather than falling back on a bad value: a server that boots with a
 * misparsed port is worse than one that refuses to start, because the failure
 * surfaces later and somewhere less obvious.
 *
 * @param source the raw environment, defaulting to `process.env`
 * @returns the validated, typed environment
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }

  if (parsed.data.CRM_LATENCY_MIN_MS > parsed.data.CRM_LATENCY_MAX_MS) {
    throw new Error('Invalid environment: CRM_LATENCY_MIN_MS exceeds CRM_LATENCY_MAX_MS');
  }
  if (parsed.data.RING_MIN_MS > parsed.data.RING_MAX_MS) {
    throw new Error('Invalid environment: RING_MIN_MS exceeds RING_MAX_MS');
  }

  return parsed.data;
}
