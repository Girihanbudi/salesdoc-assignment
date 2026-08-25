import {
  CreateSessionBodySchema,
  EndCallBodySchema,
  type CreateSessionBody,
  type EndCallBody,
} from '@salesdoc/shared';
import type { FastifyInstance } from 'fastify';
import * as sessionsHandler from '../handlers/sessions.handler.js';
import type { AppContext } from '../types/context.js';

/**
 * The dialer session lifecycle: create, start, poll, wrap up, stop.
 *
 * Bodies are declared as zod schemas here so they are validated before any
 * handler runs. The generic supplies the matching TypeScript type, so no
 * handler re-parses what the route already checked.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export function sessionRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.route<{ Body: CreateSessionBody }>({
    method: 'POST',
    url: '/api/sessions',
    schema: {
      tags: ['sessions'],
      summary: 'Create a session over selected leads',
      body: CreateSessionBodySchema,
    },
    handler: sessionsHandler.create(ctx),
  });

  app.route<{ Params: { id: string } }>({
    method: 'POST',
    url: '/api/sessions/:id/start',
    schema: { tags: ['sessions'], summary: 'Begin dialing' },
    handler: sessionsHandler.start(ctx),
  });

  app.route<{ Params: { id: string } }>({
    method: 'POST',
    url: '/api/sessions/:id/stop',
    schema: { tags: ['sessions'], summary: 'Cancel active calls and halt' },
    handler: sessionsHandler.stop(ctx),
  });

  app.route<{ Params: { id: string } }>({
    method: 'GET',
    url: '/api/sessions/:id',
    schema: { tags: ['sessions'], summary: 'The poll endpoint — fully hydrated' },
    handler: sessionsHandler.view(ctx),
  });

  app.route<{ Params: { id: string; callId: string }; Body: EndCallBody }>({
    method: 'POST',
    url: '/api/sessions/:id/calls/:callId/end',
    schema: {
      tags: ['sessions'],
      summary: 'Wrap up the connected call',
      body: EndCallBodySchema,
    },
    handler: sessionsHandler.endCall(ctx),
  });
}
