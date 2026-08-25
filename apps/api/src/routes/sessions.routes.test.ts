import { describe, expect, it } from 'vitest';
import { ERR } from '../constant/error-codes.js';
import { buildTestApp } from '../test/app.js';

describe('POST /api/sessions', () => {
  it('rejects a body whose leadIds is not an array', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { agentId: 'agent-1', leadIds: 'lead-1' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe(ERR.VALIDATION_FAILED);
  });

  it('rejects an empty selection, naming the field that failed', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: [] },
    });

    expect(res.statusCode).toBe(400);
    // The path is the point: a bare message cannot tell the UI which input to
    // mark, so losing it makes the error useless to the client.
    expect(res.json().error.details).toContainEqual({
      path: 'leadIds',
      message: 'Select at least one lead',
    });
  });

  it('rejects a lead that does not exist', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1', 'lead-999'] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe(ERR.LEAD.UNKNOWN);
  });

  it('creates a session queued with the selected leads', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { agentId: 'agent-7', leadIds: ['lead-1', 'lead-3'] },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({
      agentId: 'agent-7',
      leadQueue: ['lead-1', 'lead-3'],
      concurrency: 2,
      status: 'STOPPED',
      winnerCallId: null,
      metrics: { attempted: 0, connected: 0, failed: 0, canceled: 0 },
    });
  });
});

describe('GET /api/sessions/:id', () => {
  it('404s an unknown session', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/sessions/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe(ERR.SESSION.NOT_FOUND);
  });
});

describe('POST /api/sessions/:id/calls/:callId/end', () => {
  it('409s when the call is not the one holding the agent', async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1'] },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${created.json().data.id}/calls/call-nope/end`,
      payload: { disposition: 'INTERESTED', notes: '' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe(ERR.CALL.NOT_ACTIVE);
  });

  it('rejects a disposition outside the allowed set', async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1'] },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${created.json().data.id}/calls/whatever/end`,
      payload: { disposition: 'MAYBE_LATER', notes: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe(ERR.VALIDATION_FAILED);
  });
});

describe('GET /api/me', () => {
  it('identifies the agent by name, not by id', async () => {
    // "agent-1" is an id; it is the wrong thing to greet someone with.
    const app = await buildTestApp();
    const agent = (await app.inject({ url: '/api/me' })).json().data;

    expect(agent.id).toBe('agent-1');
    expect(agent.name).toEqual(expect.stringMatching(/\S+\s\S+/));
    expect(agent.initials).toHaveLength(2);
  });
});

describe('one session per agent', () => {
  it('refuses a second session while the first is still dialing', async () => {
    // Two sessions means four lines dialing for one person, and both could
    // elect a winner in the same moment — the collision the winner election
    // exists to prevent.
    const app = await buildTestApp();

    const first = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1', 'lead-2'] },
    });
    await app.inject({ method: 'POST', url: `/api/sessions/${first.json().data.id}/start` });

    const second = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-3', 'lead-4'] },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe(ERR.AGENT.BUSY);
    // Names the session in the way, so the agent knows what to go and stop.
    expect(second.json().error.details[0].message).toContain(first.json().data.id);
  });

  it('allows a new session once the previous one has stopped', async () => {
    const app = await buildTestApp();

    const first = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1'] },
    });
    const firstId = first.json().data.id;
    await app.inject({ method: 'POST', url: `/api/sessions/${firstId}/start` });
    await app.inject({ method: 'POST', url: `/api/sessions/${firstId}/stop` });

    const second = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-2'] },
    });

    expect(second.statusCode).toBe(201);
  });

  it('does not count a session that was never started', async () => {
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1'] },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-2'] },
    });

    expect(second.statusCode).toBe(201);
  });
});
