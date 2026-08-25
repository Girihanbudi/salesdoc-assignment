import type { FastifyInstance } from 'fastify';

/**
 * Liveness. Used by the Docker healthcheck and the keep-alive ping.
 *
 * @param app the Fastify instance
 */
export function healthRoutes(app: FastifyInstance): void {
  app.route({
    method: 'GET',
    url: '/api/health',
    schema: { summary: 'Liveness probe' },
    handler: () => ({ ok: true }),
  });
}
