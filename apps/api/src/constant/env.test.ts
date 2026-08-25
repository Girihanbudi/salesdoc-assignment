import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('runs with no environment at all', () => {
    const env = loadEnv({});

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      HOST: '0.0.0.0',
      CRM_LATENCY_MIN_MS: 300,
      CRM_LATENCY_MAX_MS: 800,
    });
    expect(env.WEB_ROOT).toBeUndefined();
  });

  it('coerces numeric vars, which arrive as strings', () => {
    const env = loadEnv({ PORT: '8080', RING_MIN_MS: '10' });

    expect(env.PORT).toBe(8080);
    expect(env.RING_MIN_MS).toBe(10);
  });

  it('refuses to boot on an unparseable port rather than falling back', () => {
    // Silently defaulting would surface later and somewhere less obvious.
    expect(() => loadEnv({ PORT: 'not-a-number' })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ PORT: '-1' })).toThrow(/Invalid environment/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/Invalid environment/);
  });

  it('rejects an inverted range, which zod alone would accept', () => {
    expect(() => loadEnv({ CRM_LATENCY_MIN_MS: '900', CRM_LATENCY_MAX_MS: '100' })).toThrow(
      /CRM_LATENCY_MIN_MS exceeds/
    );
    expect(() => loadEnv({ RING_MIN_MS: '5000', RING_MAX_MS: '1000' })).toThrow(
      /RING_MIN_MS exceeds/
    );
  });
});
