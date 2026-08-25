import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERR } from '../constant/error-codes.js';
import { loadEnv } from '../constant/env.js';
import { createContainer } from '../container.js';
import { createServer } from './create-server.js';

/**
 * Boots the app the way production does, minus listening.
 *
 * @param options optional web root to serve and whether to mount Swagger
 * @returns the Fastify instance, ready for `inject()`
 */
async function buildApp(options: { webRoot?: string; docs?: boolean } = {}) {
  const env = loadEnv({ WEB_ROOT: options.webRoot });
  return createServer(createContainer(env), env, { docs: options.docs === true });
}

describe('POST /api/sessions', () => {
  it('rejects a body whose leadIds is not an array', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { agentId: 'agent-1', leadIds: 'lead-1' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an empty selection, naming the field that failed', async () => {
    const app = await buildApp();
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
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { leadIds: ['lead-1', 'lead-999'] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe(ERR.LEAD.UNKNOWN);
  });

  it('creates a session queued with the selected leads', async () => {
    const app = await buildApp();
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
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/sessions/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe(ERR.SESSION.NOT_FOUND);
  });

  it('404s crm-activities for an unknown lead', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/leads/nope/crm-activities' });

    expect(res.statusCode).toBe(404);
  });
});

describe('ending a call', () => {
  it('409s when the call is not the one holding the agent', async () => {
    const app = await buildApp();
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
    expect(res.json().error.code).toBe(ERR.CALL.NOT_ACTIVE);
  });

  it('rejects a disposition outside the allowed set', async () => {
    const app = await buildApp();
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
    const app = await buildApp();
    const leads = (await app.inject({ method: 'GET', url: '/api/leads' })).json();

    expect(leads.length).toBeGreaterThanOrEqual(4);
    expect(leads.length).toBeLessThanOrEqual(8);
    // Both branches of the contact-upsert path must be reachable from the seed.
    expect(leads.some((l: { crmExternalId?: string }) => l.crmExternalId)).toBe(true);
    expect(leads.some((l: { crmExternalId?: string }) => !l.crmExternalId)).toBe(true);
  });

  it('starts the mock CRM empty so activity creation is observable', async () => {
    const app = await buildApp();
    const contacts = (await app.inject({ url: '/mock-crm/contacts' })).json();
    const activities = (await app.inject({ url: '/mock-crm/activities' })).json();

    expect(contacts).toEqual([]);
    expect(activities).toEqual([]);
  });
});

describe('serving the frontend', () => {
  // This whole block exists because the frontend silently stopped being served
  // once Swagger was added: swagger-ui registers @fastify/static internally, so
  // our later registration lost, and every asset fell through to the SPA
  // fallback — 404s carrying index.html, which renders a blank page.
  const webRoot = resolve(import.meta.dirname, '../../../web/dist');

  it('serves index.html at the root with a 200', async () => {
    const app = await buildApp({ webRoot, docs: true });
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });

  it('serves hashed assets as themselves, not as the SPA fallback', async () => {
    const app = await buildApp({ webRoot, docs: true });
    const index = await app.inject({ method: 'GET', url: '/' });
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(index.body)?.[1];
    expect(asset, 'index.html should reference a hashed JS bundle').toBeDefined();

    const res = await app.inject({ method: 'GET', url: asset! });
    expect(res.statusCode).toBe(200);
    // The failure mode this guards: HTML returned in place of JavaScript.
    expect(res.body).not.toContain('<div id="root">');
  });

  it('falls back to index.html for a client route, with a 200', async () => {
    const app = await buildApp({ webRoot, docs: true });
    const res = await app.inject({ method: 'GET', url: '/some/client/route' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });

  it('still 404s unknown API routes as JSON', async () => {
    const app = await buildApp({ webRoot, docs: true });

    for (const url of ['/api/nope', '/mock-crm/nope', '/leads/nope/nope']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
      expect(res.json().error.code, url).toBe('NOT_FOUND');
    }
  });

  it('serves the Swagger explorer alongside the frontend', async () => {
    const app = await buildApp({ webRoot, docs: true });
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json().paths)).toContain('/api/leads');
  });
});
