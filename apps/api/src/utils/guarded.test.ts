import { describe, expect, it, vi } from 'vitest';
import type { Clock } from './clock.js';
import { guarded } from './guarded.js';

/**
 * A clock whose scheduled work is fired by hand.
 *
 * @returns the clock plus a `fire` that runs the pending callback
 */
function manualClock() {
  let pending: (() => void) | null = null;
  const clock: Clock = {
    now: () => '2026-01-01T09:00:00.000Z',
    id: () => 'id',
    random: () => 0.5,
    schedule: (fn) => {
      pending = fn;
      return () => {
        pending = null;
      };
    },
  };
  return {
    clock,
    fire: () => {
      pending?.();
    },
  };
}

describe('guarded', () => {
  it('swallows a throw from scheduled work instead of letting it escape', () => {
    // This is the whole point: the callback runs in a setTimeout, outside any
    // request, so an uncaught throw is a process-level crash — on Render, a
    // restart that wipes every in-memory session.
    const { clock, fire } = manualClock();
    const logger = { error: vi.fn() };

    guarded(clock, logger).schedule(() => {
      throw new Error('call outcome blew up');
    }, 0);

    expect(() => fire()).not.toThrow();
  });

  it('logs the failure rather than hiding it', () => {
    const { clock, fire } = manualClock();
    const logger = { error: vi.fn() };
    const boom = new Error('call outcome blew up');

    guarded(clock, logger).schedule(() => {
      throw boom;
    }, 0);
    fire();

    expect(logger.error).toHaveBeenCalledWith({ err: boom }, 'scheduled task failed');
  });

  it('leaves successful work alone', () => {
    const { clock, fire } = manualClock();
    const logger = { error: vi.fn() };
    const ran = vi.fn();

    guarded(clock, logger).schedule(ran, 0);
    fire();

    expect(ran).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('still cancels — a guarded timer must remain droppable', () => {
    // The dialer cancels a losing line's pending outcome. If wrapping broke
    // the canceller, cancelled calls would resolve anyway.
    const { clock, fire } = manualClock();
    const ran = vi.fn();

    const cancel = guarded(clock, { error: vi.fn() }).schedule(ran, 0);
    cancel();
    fire();

    expect(ran).not.toHaveBeenCalled();
  });
});
