import type { FastifyInstance } from 'fastify';
import * as leadsHandler from '../handlers/leads.handler.js';
import type { AppContext } from '../types/context.js';

/**
 * Lead reads, including our own view of a lead's CRM activities.
 *
 * `/leads/:id/crm-activities` keeps its un-prefixed path because the
 * assignment brief names it verbatim.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export function leadRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.route({
    method: 'GET',
    url: '/api/leads',
    schema: { tags: ['leads'], summary: 'Every seeded lead' },
    handler: leadsHandler.list(ctx),
  });

  app.route<{ Params: { id: string } }>({
    method: 'GET',
    url: '/leads/:id/crm-activities',
    schema: { tags: ['leads'], summary: "Our record of a lead's CRM activities" },
    handler: leadsHandler.crmActivities(ctx),
  });
}
