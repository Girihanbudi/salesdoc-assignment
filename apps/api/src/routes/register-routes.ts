import type { FastifyInstance } from 'fastify';
import { envelope } from '../server/envelope.js';
import type { AppContext } from '../types/context.js';
import { activityRoutes } from './activities.routes.js';
import { healthRoutes } from './health.routes.js';
import { leadRoutes } from './leads.routes.js';
import { mockCrmRoutes } from './mock-crm.routes.js';
import { sessionRoutes } from './sessions.routes.js';

/**
 * Mounts every route group.
 *
 * Not a barrel — it composes rather than re-exporting, which is why it takes
 * arguments and returns nothing.
 *
 * Our own endpoints go inside a plugin scope carrying the success envelope, so
 * Fastify's encapsulation does the scoping and no route opts in by hand.
 * `/mock-crm` is registered outside it deliberately: it stands in for someone
 * else's system, and a third-party CRM would not adopt our envelope. Keeping
 * it raw makes the integration boundary visible in the response itself.
 *
 * Errors stay enveloped everywhere — a failure is our server's, whichever path
 * produced it.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export async function registerRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  await app.register(async (api) => {
    api.addHook('preSerialization', envelope);
    healthRoutes(api);
    leadRoutes(api, ctx);
    sessionRoutes(api, ctx);
    activityRoutes(api, ctx);
  });

  await app.register(async (raw) => {
    mockCrmRoutes(raw, ctx);
  });
}
