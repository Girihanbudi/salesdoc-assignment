import { describe, expect, it } from 'vitest';
import { syncToCrm } from './crm.js';
import { createHarness, ROLL } from './test-harness.js';

/**
 * Runs a session where line 1 connects, then wraps it up with a disposition.
 * @param notes
 */
function connectAndWrapUp(notes = 'Wants a demo next week.') {
  const h = createHarness(['lead-1', 'lead-2'], [ROLL.ring, ROLL.ring, ROLL.connected]);
  h.dialer.start(h.sessionId);
  h.tick();

  const winnerId = h.store.sessions.get(h.sessionId)!.winnerCallId!;
  h.dialer.endCall(h.sessionId, winnerId, { disposition: 'INTERESTED', notes });
  h.flushCrm();
  return { h, winnerId };
}

describe('idempotency', () => {
  it('ignores a replayed terminal event for a call already synced', () => {
    const h = createHarness(['lead-1'], [ROLL.ring, ROLL.noAnswer]);
    h.dialer.start(h.sessionId);
    h.drain();

    const call = [...h.store.calls.values()][0]!;
    expect([...h.store.activities.values()]).toHaveLength(1);

    // Redeliver the same terminal event, as a flaky provider webhook would.
    syncToCrm(h.crm, call, { disposition: 'NOT_INTERESTED', notes: 'duplicate' });
    h.flushCrm();

    const activities = [...h.store.activities.values()];
    expect(activities).toHaveLength(1);
    expect(activities[0]?.disposition).toBe('NO_ANSWER');
    expect(h.store.crmActivities.size).toBe(1);
  });

  it('deduplicates two events racing within one tick', () => {
    const h = createHarness(['lead-1'], [ROLL.ring, ROLL.noAnswer]);
    h.dialer.start(h.sessionId);
    h.tick();

    const call = [...h.store.calls.values()][0]!;
    // The guard is claimed before the deferred write, so a second event
    // arriving while the first is still in flight must not slip through.
    syncToCrm(h.crm, call, { disposition: 'CALLBACK', notes: 'racing' });
    h.flushCrm();

    expect([...h.store.activities.values()]).toHaveLength(1);
  });

  it('writes one activity per call across a whole session', () => {
    const h = createHarness(
      ['lead-1', 'lead-2', 'lead-3', 'lead-4'],
      Array<number>(40).fill(ROLL.noAnswer)
    );
    h.dialer.start(h.sessionId);
    h.drain();

    const activities = [...h.store.activities.values()];
    const callIds = new Set(activities.map((a) => a.callId));
    expect(activities).toHaveLength(callIds.size);
    expect(activities).toHaveLength(4);
  });
});

describe('contact upsert', () => {
  it('creates a contact before the activity when the lead has no crmExternalId', () => {
    const h = createHarness(['lead-1'], [ROLL.ring, ROLL.noAnswer]);
    expect(h.store.leads.get('lead-1')?.crmExternalId).toBeUndefined();

    h.dialer.start(h.sessionId);
    h.drain();

    const crmExternalId = h.store.leads.get('lead-1')?.crmExternalId;
    expect(crmExternalId).toBeDefined();
    expect(h.store.crmContacts.get(crmExternalId!)).toMatchObject({
      name: 'Amara Osei',
      company: 'Northwind Logistics',
    });

    const activity = [...h.store.activities.values()][0];
    expect(activity?.crmExternalId).toBe(crmExternalId);
  });

  it('reuses the existing contact rather than creating a duplicate', () => {
    // lead-2 is seeded with a crmExternalId.
    const h = createHarness(['lead-2'], [ROLL.ring, ROLL.noAnswer]);
    h.dialer.start(h.sessionId);
    h.drain();

    expect(h.store.leads.get('lead-2')?.crmExternalId).toBe('crm-contact-88213');
    expect(h.store.crmContacts.size).toBe(1);
  });
});

describe('activity contents', () => {
  it("records the agent's disposition and notes on a connected call", () => {
    const { h, winnerId } = connectAndWrapUp('Renewal is in March. Send pricing.');
    const activity = [...h.store.activities.values()].find((a) => a.callId === winnerId);

    expect(activity).toMatchObject({
      type: 'CALL',
      disposition: 'INTERESTED',
      notes: 'Renewal is in March. Send pricing.',
    });
  });

  it('derives a disposition for outcomes the agent never handled', () => {
    const h = createHarness(['lead-1'], [ROLL.ring, ROLL.voicemail]);
    h.dialer.start(h.sessionId);
    h.drain();

    const activity = [...h.store.activities.values()][0];
    expect(activity?.disposition).toBe('VOICEMAIL');
    expect(activity?.notes).not.toBe('');
  });

  it('saves the activity to both our store and the mock CRM', () => {
    const { h } = connectAndWrapUp();
    expect(h.store.activities.size).toBe(h.store.crmActivities.size);
    expect(h.store.activities.size).toBeGreaterThan(0);

    for (const [id, activity] of h.store.activities) {
      expect(h.store.crmActivities.get(id)).toEqual(activity);
    }
  });
});

describe('sync status', () => {
  it('reports pending before the write lands, then synced', () => {
    const h = createHarness(['lead-1'], [ROLL.ring, ROLL.noAnswer]);
    h.dialer.start(h.sessionId);
    h.tick(); // call resolves; CRM write is deferred

    const callId = [...h.store.calls.keys()][0]!;
    expect(h.store.crmSyncStatus.get(callId)).toBe('pending');

    h.flushCrm();
    expect(h.store.crmSyncStatus.get(callId)).toBe('synced');
  });
});
