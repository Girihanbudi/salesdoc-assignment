import type { FastifyInstance } from 'fastify';
import * as agentHandler from '../handlers/agent.handler.js';
import type { AppContext } from '../types/context.js';

/**
 * Who the app is running as.
 *
 * `/me` rather than `/agents/:id` because there is no auth and no second
 * agent — naming it as a collection would imply a switcher that does not exist.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export function agentRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.route({
    method: 'GET',
    url: '/api/me',
    schema: { tags: ['agent'], summary: 'The signed-in agent' },
    handler: agentHandler.current(ctx),
  });
}
