import { describe, expect, it } from 'vitest';
import { CONCURRENCY } from '@salesdoc/shared';
import { createHarness, ROLL } from '../test/harness.js';

const SIX_LEADS = ['lead-1', 'lead-2', 'lead-3', 'lead-4', 'lead-5', 'lead-6'];

describe('winner election', () => {
  it('gives the agent the first call to connect and cancels the other line', () => {
    // 2 rings, then line 1 connects.
    const h = createHarness(
      ['lead-1', 'lead-2'],
      [ROLL.ring, ROLL.ring, ROLL.connected, ROLL.talk]
    );
    h.ctx.dialer.start(h.sessionId);

    const [firstId, secondId] = h.store.sessions.get(h.sessionId)!.activeCallIds;
    h.tick(); // resolve line 1

    expect(h.store.calls.get(firstId!)?.status).toBe('CONNECTED');
    expect(h.store.calls.get(secondId!)?.status).toBe('CANCELED_BY_DIALER');
    expect(h.store.sessions.get(h.sessionId)?.winnerCallId).toBe(firstId);
  });

  it('keeps the connected call on its line while the conversation runs', () => {
    // The brief says "show 2 active lines". Dropping the winner from
    // activeCallIds made both line cards read "Idle" during a live call.
    const h = createHarness(
      ['lead-1', 'lead-2'],
      [ROLL.ring, ROLL.ring, ROLL.connected, ROLL.talk]
    );
    h.ctx.dialer.start(h.sessionId);
    h.tick();

    const session = h.store.sessions.get(h.sessionId)!;
    expect(session.activeCallIds).toContain(session.winnerCallId);
  });

  it('records talk time, not ring time', () => {
    const h = createHarness(
      ['lead-1', 'lead-2'],
      [ROLL.ring, ROLL.ring, ROLL.connected, ROLL.talk]
    );
    h.ctx.dialer.start(h.sessionId);
    h.tick();

    const winnerId = h.store.sessions.get(h.sessionId)!.winnerCallId!;
    // Still talking: an unfinished call has no end.
    expect(h.store.calls.get(winnerId)?.endedAt).toBeNull();

    h.tick(); // the conversation runs out
    expect(h.store.calls.get(winnerId)?.endedAt).not.toBeNull();
  });

  it('does not dial while a winner holds the agent', () => {
    const h = createHarness(SIX_LEADS, [ROLL.ring, ROLL.ring, ROLL.connected, ROLL.talk]);
    h.ctx.dialer.start(h.sessionId);
    h.tick();

    const session = h.store.sessions.get(h.sessionId)!;
    // Only the winner is live; the cancelled line is not refilled.
    expect(session.activeCallIds).toHaveLength(1);
    expect(session.leadQueue).toEqual(['lead-3', 'lead-4', 'lead-5', 'lead-6']);
  });

  it('resumes dialing on its own once the conversation ends', () => {
    // No human step: the brief has no wrap-up screen, so a session must run to
    // completion unattended.
    const h = createHarness(SIX_LEADS, [
      ROLL.ring,
      ROLL.ring,
      ROLL.connected,
      ROLL.talk,
      ROLL.ring, // the two lines refill by themselves
      ROLL.ring,
    ]);
    h.ctx.dialer.start(h.sessionId);
    h.tick(); // connect
    h.tick(); // conversation ends

    const session = h.store.sessions.get(h.sessionId)!;
    expect(session.winnerCallId).toBeNull();
    expect(session.activeCallIds).toHaveLength(CONCURRENCY);
    expect(session.leadQueue).toEqual(['lead-5', 'lead-6']);
  });
});

describe('concurrency', () => {
  it('never runs more than two lines across a long queue', () => {
    const h = createHarness(SIX_LEADS, Array<number>(60).fill(ROLL.noAnswer));
    h.ctx.dialer.start(h.sessionId);

    let guard = 0;
    do {
      const active = h.store.sessions.get(h.sessionId)!.activeCallIds.length;
      expect(active).toBeLessThanOrEqual(CONCURRENCY);
      if (++guard > 200) throw new Error('did not settle');
    } while (h.tick());

    const session = h.store.sessions.get(h.sessionId)!;
    expect(session.metrics.attempted).toBe(SIX_LEADS.length);
  });

  it('stops once the queue drains and the last line clears', () => {
    const h = createHarness(SIX_LEADS, Array<number>(60).fill(ROLL.noAnswer));
    h.ctx.dialer.start(h.sessionId);
    h.drain();

    const session = h.store.sessions.get(h.sessionId)!;
    expect(session.status).toBe('STOPPED');
    expect(session.leadQueue).toHaveLength(0);
    expect(session.activeCallIds).toHaveLength(0);
  });
});

describe('metrics', () => {
  it('counts each outcome in its own bucket', () => {
    // line1 NO_ANSWER, line2 VOICEMAIL, line3 BUSY, then line4 CONNECTED
    // cancels line5.
    const h = createHarness(SIX_LEADS, [
      ROLL.ring,
      ROLL.ring,
      ROLL.noAnswer,
      ROLL.ring,
      ROLL.voicemail,
      ROLL.ring,
      ROLL.busy,
      ROLL.ring,
      ROLL.connected,
    ]);
    h.ctx.dialer.start(h.sessionId);
    h.tick();
    h.tick();
    h.tick();
    h.tick();

    const session = h.store.sessions.get(h.sessionId)!;
    const { metrics } = session;

    // Five dialed, not six: the connect on line 4 stopped the queue, so
    // lead-6 was never attempted.
    expect(metrics).toEqual({ attempted: 5, connected: 1, failed: 3, canceled: 1 });
    expect(session.leadQueue).toEqual(['lead-6']);

    // Every attempt lands in exactly one bucket.
    expect(metrics.connected + metrics.failed + metrics.canceled).toBe(metrics.attempted);
  });
});

describe('stop', () => {
  it('cancels in-flight calls and their pending outcomes never fire', () => {
    const h = createHarness(SIX_LEADS, [ROLL.ring, ROLL.ring]);
    h.ctx.dialer.start(h.sessionId);
    const active = [...h.store.sessions.get(h.sessionId)!.activeCallIds];

    h.ctx.dialer.stop(h.sessionId);
    for (const callId of active) {
      expect(h.store.calls.get(callId)?.status).toBe('CANCELED_BY_DIALER');
    }

    // If a canceled timer still fired it would roll an outcome and throw for
    // want of a random value, or overwrite the status. Neither may happen.
    h.drain();
    for (const callId of active) {
      expect(h.store.calls.get(callId)?.status).toBe('CANCELED_BY_DIALER');
    }
    expect(h.store.sessions.get(h.sessionId)?.status).toBe('STOPPED');
  });

  it('records a conversation that was cut short rather than losing it', () => {
    const h = createHarness(SIX_LEADS, [ROLL.ring, ROLL.ring, ROLL.connected, ROLL.talk]);
    h.ctx.dialer.start(h.sessionId);
    h.tick(); // connect — the conversation is still running

    const winnerId = h.store.sessions.get(h.sessionId)!.winnerCallId!;
    h.ctx.dialer.stop(h.sessionId);
    h.drain();

    const activity = [...h.store.activities.values()].find((a) => a.callId === winnerId);
    expect(activity, 'the call happened, so the CRM must say so').toBeDefined();
    // Filed as what it was — a connected call — with a note saying it was cut
    // short. Not invented as some other outcome.
    expect(activity?.disposition).toBe('CONNECTED');
    expect(activity?.notes).toContain('cut short');
    expect(h.store.calls.get(winnerId)?.endedAt).not.toBeNull();
  });
});
