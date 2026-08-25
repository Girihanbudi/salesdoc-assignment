import type { FastifyInstance } from 'fastify';
import * as activitiesHandler from '../handlers/activities.handler.js';
import type { AppContext } from '../types/context.js';

/**
 * Our own record of what was written to the CRM.
 *
 * Distinct from `/mock-crm/*`, which is the CRM's own view: these are
 * enveloped, ours, and keyed by the call that produced them.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export function activityRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.route({
    method: 'GET',
    url: '/api/activities',
    schema: { tags: ['activities'], summary: 'Every CRM activity, newest first' },
    handler: activitiesHandler.list(ctx),
  });

  app.route<{ Params: { callId: string } }>({
    method: 'GET',
    url: '/api/activities/:callId',
    schema: { tags: ['activities'], summary: 'One activity with its lead and call' },
    handler: activitiesHandler.detail(ctx),
  });
}
