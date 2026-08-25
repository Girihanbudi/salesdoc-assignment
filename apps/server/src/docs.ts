import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Serves an interactive API explorer at `/docs`.
 *
 * Registered before the routes so Swagger sees them. It exists so the API can
 * be exercised from a browser without Postman or a curl incantation.
 *
 * @param app the Fastify instance to document
 */
export async function registerDocs(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SalesDoc Dialer API',
        description:
          'Two-line outbound dialer with a mock CRM. Create a session from ' +
          'some leads, start it, then poll GET /api/sessions/{id}.',
        version: '1.0.0',
      },
      tags: [
        { name: 'leads', description: 'Seeded leads' },
        { name: 'sessions', description: 'Dialer sessions and live calls' },
        { name: 'mock-crm', description: 'Stands in for an external CRM' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });
}
