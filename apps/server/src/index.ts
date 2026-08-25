import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/api/health', () => ({ ok: true }));

// Render assigns PORT and cannot reach a server bound to localhost.
await app.listen({ port: Number(process.env['PORT'] ?? 3000), host: '0.0.0.0' });
