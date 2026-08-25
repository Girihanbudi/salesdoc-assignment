import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERR } from '../constant/error-codes.js';
import { buildTestApp } from '../test/app.js';

// What this file owns: how the server is assembled. Endpoint behaviour lives
// beside its routes; this is about plugin ordering and the fallbacks.
const webRoot = resolve(import.meta.dirname, '../../../web/dist');

describe('serving the frontend', () => {
  // This block exists because the frontend silently stopped being served once
  // Swagger was added: swagger-ui registers @fastify/static internally, and
  // registering ours after the routes meant every asset fell through to the
  // SPA fallback — 404s carrying index.html, which renders a blank page.
  it('serves index.html at the root with a 200', async () => {
    const app = await buildTestApp({ webRoot, docs: true });
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });

  it('serves hashed assets as themselves, not as the SPA fallback', async () => {
    const app = await buildTestApp({ webRoot, docs: true });
    const index = await app.inject({ method: 'GET', url: '/' });
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(index.body)?.[1];
    expect(asset, 'index.html should reference a hashed JS bundle').toBeDefined();

    const res = await app.inject({ method: 'GET', url: asset! });
    expect(res.statusCode).toBe(200);
    // The failure mode this guards: HTML returned in place of JavaScript.
    expect(res.body).not.toContain('<div id="root">');
  });

  it('falls back to index.html for a client route, with a 200', async () => {
    const app = await buildTestApp({ webRoot, docs: true });
    const res = await app.inject({ method: 'GET', url: '/some/client/route' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });

  it('still 404s unknown API routes as JSON', async () => {
    const app = await buildTestApp({ webRoot, docs: true });

    for (const url of ['/api/nope', '/mock-crm/nope', '/leads/nope/nope']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
      expect(res.json().error.code, url).toBe(ERR.NOT_FOUND);
    }
  });
});

describe('swagger', () => {
  it('serves the explorer alongside the frontend', async () => {
    const app = await buildTestApp({ webRoot, docs: true });
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json().paths)).toContain('/api/leads');
  });

  it('documents every route, so /docs cannot drift from the API', async () => {
    const app = await buildTestApp({ docs: true });
    const paths = Object.keys((await app.inject({ url: '/docs/json' })).json().paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/health',
        '/api/leads',
        '/api/sessions',
        '/api/sessions/{id}',
        '/leads/{id}/crm-activities',
        '/mock-crm/contacts',
        '/mock-crm/activities',
      ])
    );
  });
});
