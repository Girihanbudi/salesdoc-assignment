import { loadEnv } from '../constant/env.js';
import { createContainer } from '../container.js';
import { createServer } from '../server/create-server.js';
import type { FastifyInstance } from 'fastify';

/** Options for {@link buildTestApp}. */
export interface TestAppOptions {
  /** Absolute path to a built frontend. Omit to run API-only. */
  webRoot?: string;
  /** Mount Swagger at /docs. Off by default — it is slow to boot. */
  docs?: boolean;
}

/**
 * Boots the app the way production does, minus listening.
 *
 * Goes through `createContainer` and `createServer` rather than assembling
 * pieces by hand, so the wiring itself is under test and not just the units.
 *
 * @param options web root and docs toggles
 * @returns the Fastify instance, ready for `inject()`
 */
export async function buildTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const env = loadEnv({ WEB_ROOT: options.webRoot });
  return createServer(createContainer(env), env, { docs: options.docs === true });
}
