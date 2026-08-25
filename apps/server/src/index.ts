import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import { buildApp } from './app.js';

const app = await buildApp({ logger: true, docs: true });

if (process.env['NODE_ENV'] === 'production') {
  // One process, one port: Fastify serves the API and the React build together,
  // so there is no CORS and no base-URL env var to get wrong.
  await app.register(fastifyStatic, {
    root: resolve(import.meta.dirname, '../../web/dist'),
  });

  app.setNotFoundHandler((request, reply) => {
    const isApi =
      request.url.startsWith('/api') ||
      request.url.startsWith('/mock-crm') ||
      request.url.startsWith('/leads');

    return isApi
      ? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No such route' } })
      : reply.sendFile('index.html');
  });
}

// Render assigns PORT and cannot reach a server bound to localhost.
await app.listen({ port: Number(process.env['PORT'] ?? 3000), host: '0.0.0.0' });
