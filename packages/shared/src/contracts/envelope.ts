import { z } from 'zod';

/** Context attached to every response, success or failure. */
export const MetaSchema = z.object({
  /** Fastify's per-request id. Quote it in a bug report to find the log line. */
  requestId: z.string(),
  timestamp: z.string().datetime(),
});
export type Meta = z.infer<typeof MetaSchema>;

/** One field that failed validation. The path is what lets a UI mark it. */
export const ErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/**
 * The failure envelope.
 *
 * `success` is a literal so a client can discriminate on it: `if (res.success)`
 * narrows to `data`, `else` narrows to `error`, with no shape probing.
 */
export const ApiFailureSchema = z.object({
  success: z.literal(false),
  error: z.object({
    /** Namespaced and stable, e.g. `SESSION.NOT_FOUND`. Clients branch on this. */
    code: z.string(),
    /** Human-readable. Safe to reword; the code is the contract. */
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
  }),
  meta: MetaSchema,
});
export type ApiFailure = z.infer<typeof ApiFailureSchema>;

/**
 * Wraps a payload schema in the success envelope.
 *
 * @param data the schema describing this endpoint's payload
 * @returns the full success-response schema
 */
export function ok<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    data,
    meta: MetaSchema,
  });
}

/**
 * Builds the discriminated union of both outcomes for one endpoint.
 *
 * @param data the schema describing this endpoint's payload
 * @returns a schema matching either outcome
 */
export function apiResponse<T extends z.ZodTypeAny>(data: T) {
  return z.union([ok(data), ApiFailureSchema]);
}
