import { z } from 'zod';

/**
 * Concurrency is fixed at 2 by the assignment brief. It is stored on the
 * session as a field (rather than being a bare constant) because the brief
 * lists it as part of the DialerSession model.
 */
export const CONCURRENCY = 2;

/** Running totals for a session. Every dial increments `attempted`. */
export const SessionMetricsSchema = z.object({
  attempted: z.number().int().nonnegative(),
  /** CONNECTED */
  connected: z.number().int().nonnegative(),
  /** NO_ANSWER | BUSY | VOICEMAIL */
  failed: z.number().int().nonnegative(),
  /** CANCELED_BY_DIALER */
  canceled: z.number().int().nonnegative(),
});
export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;

/** One agent working a queue of leads across {@link CONCURRENCY} lines. */
export const DialerSessionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  /** Lead ids not yet dialed, in order. */
  leadQueue: z.array(z.string()),
  concurrency: z.literal(CONCURRENCY),
  /** At most {@link CONCURRENCY} entries. Enforced by the dialer engine. */
  activeCallIds: z.array(z.string()).max(CONCURRENCY),
  /** The first call to CONNECT. Null until one does, and after wrap-up. */
  winnerCallId: z.string().nullable(),
  status: z.enum(['RUNNING', 'STOPPED']),
  metrics: SessionMetricsSchema,
});
export type DialerSession = z.infer<typeof DialerSessionSchema>;
