import type { Clock } from './clock.js';

/** The subset of a Fastify logger this needs. */
export interface GuardLogger {
  error: (context: Record<string, unknown>, message: string) => void;
}

/**
 * Wraps a clock so a throw inside scheduled work cannot kill the process.
 *
 * Call outcomes and CRM writes run in `setTimeout` callbacks — outside any
 * request, so Fastify's error handler never sees them. An uncaught throw there
 * is a process-level crash: on Render that is a restart, and every in-memory
 * session is gone. One failed call outcome must not cost the whole server.
 *
 * Applied once in the container, so neither the dialer nor the CRM sync needs
 * to know that logging exists.
 *
 * @param clock the clock to wrap
 * @param logger where failures are reported
 * @returns a clock whose scheduled callbacks log and swallow instead of throwing
 */
export function guarded(clock: Clock, logger: GuardLogger): Clock {
  return {
    ...clock,
    schedule: (fn, ms) =>
      clock.schedule(() => {
        try {
          fn();
        } catch (cause) {
          logger.error({ err: cause }, 'scheduled task failed');
        }
      }, ms),
  };
}
