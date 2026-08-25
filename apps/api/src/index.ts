import { resolve } from 'node:path';
import { loadEnv } from './constant/env.js';
import { createContainer } from './container.js';
import { createServer } from './server/create-server.js';

const base = loadEnv();

// In production one process serves the API and the React build on one port, so
// there is no CORS and no base-URL env var to get wrong.
const env =
  base.NODE_ENV === 'production' && base.WEB_ROOT === undefined
    ? { ...base, WEB_ROOT: resolve(import.meta.dirname, '../../web/dist') }
    : base;

const app = await createServer(createContainer(env), env, { logger: true, docs: true });

// Render assigns PORT and cannot reach a server bound to localhost.
await app.listen({ port: env.PORT, host: env.HOST });

// Render sends SIGTERM on every deploy. Without this, in-flight requests are
// dropped mid-response rather than being allowed to finish.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(
      () => process.exit(0),
      (cause: unknown) => {
        app.log.error({ err: cause }, 'shutdown failed');
        process.exit(1);
      }
    );
  });
}
