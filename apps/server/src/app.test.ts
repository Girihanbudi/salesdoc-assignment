import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('POST /api/sessions', () => {
  it('rejects a body whose leadIds is not an array', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { agentId: 'agent-1', leadIds: 'lead-1' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an empty selection', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a lead that does not exist', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1', 'lead-999'] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('UNKNOWN_LEAD');
  });

  it('creates a session queued with the selected leads', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { agentId: 'agent-7', leadIds: ['lead-1', 'lead-3'] },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      agentId: 'agent-7',
      leadQueue: ['lead-1', 'lead-3'],
      concurrency: 2,
      status: 'STOPPED',
      winnerCallId: null,
      metrics: { attempted: 0, connected: 0, failed: 0, canceled: 0 },
    });
  });
});

describe('unknown resources', () => {
  it('404s an unknown session', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/sessions/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('404s crm-activities for an unknown lead', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/leads/nope/crm-activities' });

    expect(res.statusCode).toBe(404);
  });
});

describe('ending a call', () => {
  it('409s when the call is not the one holding the agent', async () => {
    const app = buildApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1'] },
    });
    const sessionId = created.json().id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/calls/call-nope/end`,
      payload: { disposition: 'INTERESTED', notes: '' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('NOT_ACTIVE');
  });

  it('rejects a disposition outside the allowed set', async () => {
    const app = buildApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1'] },
    });
    const sessionId = created.json().id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/calls/whatever/end`,
      payload: { disposition: 'MAYBE_LATER', notes: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });
});

describe('seeded data', () => {
  it('serves between four and eight leads, as the brief requires', async () => {
    const app = buildApp();
    const leads = (await app.inject({ method: 'GET', url: '/api/leads' })).json();

    expect(leads.length).toBeGreaterThanOrEqual(4);
    expect(leads.length).toBeLessThanOrEqual(8);
    // Both branches of the contact-upsert path must be reachable from the seed.
    expect(leads.some((l: { crmExternalId?: string }) => l.crmExternalId)).toBe(true);
    expect(leads.some((l: { crmExternalId?: string }) => !l.crmExternalId)).toBe(true);
  });

  it('starts the mock CRM empty so activity creation is observable', async () => {
    const app = buildApp();
    const contacts = (await app.inject({ url: '/mock-crm/contacts' })).json();
    const activities = (await app.inject({ url: '/mock-crm/activities' })).json();

    expect(contacts).toEqual([]);
    expect(activities).toEqual([]);
  });
});
