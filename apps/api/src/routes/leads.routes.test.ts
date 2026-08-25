import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test/app.js';

describe('GET /api/leads', () => {
  it('serves between four and eight leads, as the brief requires', async () => {
    const app = await buildTestApp();
    const leads = (await app.inject({ method: 'GET', url: '/api/leads' })).json().data;

    expect(leads.length).toBeGreaterThanOrEqual(4);
    expect(leads.length).toBeLessThanOrEqual(8);
    // Both branches of the contact-upsert path must be reachable from the seed.
    expect(leads.some((l: { crmExternalId?: string }) => l.crmExternalId)).toBe(true);
    expect(leads.some((l: { crmExternalId?: string }) => !l.crmExternalId)).toBe(true);
  });
});

describe('GET /leads/:id/crm-activities', () => {
  it('404s for an unknown lead', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/leads/nope/crm-activities' });

    expect(res.statusCode).toBe(404);
  });

  it('starts empty for a known lead', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/leads/lead-1/crm-activities' });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});
