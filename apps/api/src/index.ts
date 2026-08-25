import { resolve } from 'node:path';
import { buildApp } from './app.js';

// One process, one port: Fastify serves the API and the React build together,
// so there is no CORS and no base-URL env var to get wrong.
const app = await buildApp({
  logger: true,
  docs: true,
  webRoot: resolve(import.meta.dirname, '../../web/dist'),
});

// Render assigns PORT and cannot reach a server bound to localhost.
await app.listen({ port: Number(process.env['PORT'] ?? 3000), host: '0.0.0.0' });
