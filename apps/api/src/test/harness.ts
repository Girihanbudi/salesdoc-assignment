import { loadEnv } from '../constant/env.js';
import { createContainer } from '../container.js';
import { createStore, type Store } from '../db/store.js';
import type { AppContext } from '../types/context.js';
import type { Clock } from '../utils/clock.js';

/**
 * A scheduled callback the test controls. Timers fire in the order they were
 * scheduled rather than by delay — deterministic, and the ordering the engine
 * actually depends on.
 */
interface FakeTimer {
  fn: () => void;
  ms: number;
  canceled: boolean;
  fired: boolean;
}

/** Test rig exposing the wired app plus manual control of time and randomness. */
export interface Harness {
  store: Store;
  ctx: AppContext;
  sessionId: string;
  /**
   * Resolves the next ringing call.
   *
   * CRM syncs live on their own queue, so a tick always advances exactly one
   * call and tests can count them.
   *
   * @returns false when no call was left ringing
   */
  tick: () => boolean;
  /** Runs every deferred CRM write. */
  flushCrm: () => void;
  /** Resolves all calls and runs their CRM writes. */
  drain: () => void;
}

/**
 * `random()` values that select each outcome, for readable tests.
 *
 * Weights are cumulative: CONNECTED below 0.35, NO_ANSWER below 0.65,
 * VOICEMAIL below 0.85, BUSY above.
 */
export const ROLL = {
  connected: 0.1,
  noAnswer: 0.5,
  voicemail: 0.7,
  busy: 0.9,
  /** Any value works for a ring duration; this one reads as "don't care". */
  ring: 0.5,
  /** Same, for the length of a mocked conversation. */
  talk: 0.5,
} as const;

/**
 * Builds the app wired to fake time, ids, and randomness.
 *
 * `randoms` is consumed in call order: one per dial (ring duration), one per
 * resolved call (outcome), and one more per connect (how long the conversation
 * lasts). Running out throws rather than silently repeating, so a miscounted
 * test fails loudly.
 *
 * @param leadIds leads to queue on the session
 * @param randoms the sequence `random()` returns
 * @returns the harness
 */
export function createHarness(leadIds: string[], randoms: number[]): Harness {
  const store = createStore();
  const callTimers: FakeTimer[] = [];
  const crmTimers: FakeTimer[] = [];
  let randomIndex = 0;
  let idCounter = 0;
  let clockMs = Date.parse('2026-01-01T09:00:00.000Z');

  /**
   * Appends a timer to one of the two queues.
   *
   * @param queue the queue to append to
   * @param fn the callback
   * @param ms the nominal delay, recorded but not used for ordering
   * @returns a canceller
   */
  const push = (queue: FakeTimer[], fn: () => void, ms: number): (() => void) => {
    const timer: FakeTimer = { fn, ms, canceled: false, fired: false };
    queue.push(timer);
    return () => {
      timer.canceled = true;
    };
  };

  /**
   * Fires the first unfired, uncancelled timer on a queue.
   *
   * @param queue the queue to advance
   * @returns false when the queue held nothing to fire
   */
  const fireNext = (queue: FakeTimer[]): boolean => {
    const timer = queue.find((t) => !t.fired && !t.canceled);
    if (!timer) return false;
    timer.fired = true;
    timer.fn();
    return true;
  };

  /** Time, ids, and randomness — shared; only the queue differs. */
  const base = {
    now: (): string => {
      clockMs += 1000;
      return new Date(clockMs).toISOString();
    },
    id: (): string => {
      idCounter += 1;
      return String(idCounter);
    },
    random: (): number => {
      const value = randoms[randomIndex];
      if (value === undefined) {
        throw new Error(`harness ran out of random values at index ${randomIndex}`);
      }
      randomIndex += 1;
      return value;
    },
  };

  // Two clocks, differing only in which queue they schedule onto. Call outcomes
  // and CRM writes are independent timelines, so a tick must advance exactly
  // one call — otherwise a CRM write lands between two calls and the tests can
  // no longer count ticks.
  const clock: Clock = { ...base, schedule: (fn, ms) => push(callTimers, fn, ms) };
  const crmClock: Clock = { ...base, schedule: (fn, ms) => push(crmTimers, fn, ms) };

  // CRM latency is fixed so it consumes no random values, keeping the sequence
  // in the tests about call outcomes only.
  const env = loadEnv({ CRM_LATENCY_MIN_MS: '500', CRM_LATENCY_MAX_MS: '500' });

  const ctx = createContainer(env, { store, clock, crmClock });

  const session = ctx.sessions.create('session-1', 'agent-1', leadIds);

  const tick = (): boolean => fireNext(callTimers);

  const flushCrm = (): void => {
    let guard = 0;
    while (fireNext(crmTimers)) {
      if (++guard > 500) throw new Error('CRM queue did not settle');
    }
  };

  return {
    store,
    ctx,
    sessionId: session.id,
    tick,
    flushCrm,
    drain: () => {
      // Bounded so a scheduling bug fails the test instead of hanging it.
      let guard = 0;
      while (tick()) {
        if (++guard > 500) throw new Error('drain did not settle within 500 timers');
      }
      flushCrm();
    },
  };
}
