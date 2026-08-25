import { describe, expect, it } from 'vitest';
import { ERR } from '../constant/error-codes.js';
import { buildTestApp } from '../test/app.js';

describe('response envelope', () => {
  it('wraps a success payload, with a request id and timestamp', async () => {
    const app = await buildTestApp();
    const body = (await app.inject({ method: 'GET', url: '/api/leads' })).json();

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.requestId).toEqual(expect.any(String));
    expect(() => new Date(body.meta.timestamp).toISOString()).not.toThrow();
    // data and error are mutually exclusive, so a client needs one parse path.
    expect(body).not.toHaveProperty('error');
  });

  it('wraps a failure the same way, and never alongside data', async () => {
    const app = await buildTestApp();
    const body = (await app.inject({ method: 'GET', url: '/api/sessions/nope' })).json();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERR.SESSION.NOT_FOUND);
    expect(body.meta.requestId).toEqual(expect.any(String));
    expect(body).not.toHaveProperty('data');
  });

  it('does not double-wrap an error body', async () => {
    // The preSerialization hook runs for error responses too; without its
    // guard it would nest the failure inside a success envelope.
    const app = await buildTestApp();
    const body = (await app.inject({ method: 'GET', url: '/api/sessions/nope' })).json();

    expect(body.data).toBeUndefined();
    expect(body.error).toBeDefined();
  });

  it('gives each request its own id', async () => {
    const app = await buildTestApp();
    const a = (await app.inject({ url: '/api/leads' })).json();
    const b = (await app.inject({ url: '/api/leads' })).json();

    expect(a.meta.requestId).not.toBe(b.meta.requestId);
  });
});
