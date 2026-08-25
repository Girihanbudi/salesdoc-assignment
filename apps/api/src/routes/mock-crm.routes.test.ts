import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test/app.js';

describe('mock CRM', () => {
  it('starts empty so activity creation is observable in a demo', async () => {
    const app = await buildTestApp();

    expect((await app.inject({ url: '/mock-crm/contacts' })).json()).toEqual([]);
    expect((await app.inject({ url: '/mock-crm/activities' })).json()).toEqual([]);
  });

  it(`returns bare arrays — it stands in for someone else's API`, async () => {
    // A third-party CRM would not adopt our envelope. Keeping these raw makes
    // the integration boundary visible in the response itself.
    const app = await buildTestApp();

    for (const url of ['/mock-crm/contacts', '/mock-crm/activities']) {
      const body = (await app.inject({ url })).json();
      expect(Array.isArray(body), url).toBe(true);
      expect(body, url).not.toHaveProperty('success');
    }
  });
});
