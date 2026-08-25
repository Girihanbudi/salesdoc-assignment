import {
  CreateSessionBodySchema,
  EndCallBodySchema,
} from '@salesdoc/shared';
import type { FastifyInstance } from 'fastify';
import * as leadsHandler from '../handlers/leads.handler.js';
import * as mockCrmHandler from '../handlers/mock-crm.handler.js';
import * as sessionsHandler from '../handlers/sessions.handler.js';
import type { AppContext } from '../types/context.js';

/**
 * Mounts every route. Not a barrel — it composes, it does not re-export.
 *
 * Each entry is uri, schema, handler and nothing else. Shape validation is
 * declared here so it runs before the handler; anything needing the database
 * is a business rule and lives in a controller.
 *
 * @param app the Fastify instance
 * @param ctx the app context handed to each handler
 */
export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.route({
    method: 'GET',
    url: '/api/health',
    schema: { summary: 'Liveness probe' },
    handler: () => ({ ok: true }),
  });

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

  app.route<{ Body: unknown }>({
    method: 'POST',
    url: '/api/sessions',
    schema: {
      tags: ['sessions'],
      summary: 'Create a session over selected leads',
      body: CreateSessionBodySchema,
    },
    handler: (request, reply) => {
      const session = sessionsHandler.create(ctx)({
        body: CreateSessionBodySchema.parse(request.body),
      });
      return reply.code(201).send(session);
    },
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

  app.route<{ Params: { id: string; callId: string }; Body: unknown }>({
    method: 'POST',
    url: '/api/sessions/:id/calls/:callId/end',
    schema: {
      tags: ['sessions'],
      summary: 'Wrap up the connected call',
      body: EndCallBodySchema,
    },
    handler: (request) =>
      sessionsHandler.endCall(ctx)({
        params: request.params,
        body: EndCallBodySchema.parse(request.body),
      }),
  });

  // Stands in for an external CRM's own API.
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
