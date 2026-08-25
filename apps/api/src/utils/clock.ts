import { randomUUID } from 'node:crypto';

/**
 * Everything nondeterministic, behind one interface.
 *
 * Production passes the real implementations; tests pass a fake clock, a
 * counter, a scripted random sequence, and a manual timer queue. This is what
 * lets "line 1 connects, line 2 is cancelled" be asserted exactly, with no
 * sleeping and no flake.
 */
export interface Clock {
  /** Current time as an ISO-8601 string. */
  now: () => string;
  /** Short unique identifier. */
  id: () => string;
  /** Uniform random in [0, 1). */
  random: () => number;
  /** Defers work, returning a canceller so a pending outcome can be dropped. */
  schedule: (fn: () => void, ms: number) => () => void;
}

/**
 * The real clock.
 *
 * Timers are unref'd so a pending call outcome never keeps the process alive
 * during shutdown or after a test file finishes.
 *
 * @returns a Clock backed by Date, randomUUID, Math.random, and setTimeout
 */
export function createClock(): Clock {
  return {
    now: () => new Date().toISOString(),
    id: () => randomUUID().slice(0, 8),
    random: Math.random,
    schedule: (fn, ms) => {
      const handle = setTimeout(fn, ms);
      handle.unref();
      return () => clearTimeout(handle);
    },
  };
}
