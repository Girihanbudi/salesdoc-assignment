import type { FastifyInstance } from 'fastify';
import * as mockCrmHandler from '../handlers/mock-crm.handler.js';
import type { AppContext } from '../types/context.js';

/**
 * Stands in for an external CRM's own API.
 *
 * Deliberately unprefixed and shaped the way a third party would return data —
 * this is the integration boundary, not one of our endpoints.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export function mockCrmRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.route({
    method: 'GET',
    url: '/mock-crm/contacts',
    schema: { tags: ['mock-crm'], summary: "The CRM's contacts" },
    handler: mockCrmHandler.contacts(ctx),
  });

  app.route({
    method: 'GET',
    url: '/mock-crm/activities',
    schema: { tags: ['mock-crm'], summary: "The CRM's activities" },
    handler: mockCrmHandler.activities(ctx),
  });
}
