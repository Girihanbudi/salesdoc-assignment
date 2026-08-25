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
