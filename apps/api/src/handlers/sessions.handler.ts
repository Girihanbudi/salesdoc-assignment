import type {
  CreateSessionBody,
  DialerSession,
  EndCallBody,
  SessionView,
} from '@salesdoc/shared';
import type { FastifyReply } from 'fastify';
import { ERR } from '../constant/error-codes.js';
import type { AppContext } from '../types/context.js';
import { AppError } from '../utils/AppError.js';
import { withSession } from '../utils/with-entity.js';

/** The `:id` every session route carries. */
interface SessionParams {
  params: { id: string };
}

/**
 * Creates a session over the selected leads.
 *
 * Shape validation already ran in the route schema, so the only check left is
 * the one that needs the database: do these leads exist?
 *
 * @param ctx the app context
 * @returns a handler replying 201 with the new session
 */
export const create =
  (ctx: AppContext) =>
  (request: { body: CreateSessionBody }, reply: FastifyReply): FastifyReply => {
    const missing = ctx.leads.findMissingIds(request.body.leadIds);
    if (missing.length > 0) {
      throw new AppError(400, ERR.LEAD.UNKNOWN, `No such lead: ${missing.join(', ')}`);
    }

    const session = ctx.sessions.create(
      `session-${ctx.id()}`,
      request.body.agentId,
      request.body.leadIds
    );
    return reply.code(201).send(session);
  };

/**
 * Begins dialing a session.
 *
 * @param ctx the app context
 * @returns a handler resolving to the updated session
 */
export const start = (ctx: AppContext) =>
  withSession<SessionParams, DialerSession | undefined>(ctx, (session) => {
    ctx.dialer.start(session.id);
    return ctx.sessions.findById(session.id);
  });

/**
 * Cancels a session's active calls and halts it.
 *
 * @param ctx the app context
 * @returns a handler resolving to the updated session
 */
export const stop = (ctx: AppContext) =>
  withSession<SessionParams, DialerSession | undefined>(ctx, (session) => {
    ctx.dialer.stop(session.id);
    return ctx.sessions.findById(session.id);
  });

/**
 * The endpoint the dashboard polls — one fully hydrated payload.
 *
 * @param ctx the app context
 * @returns a handler resolving to the session view
 */
export const view = (ctx: AppContext) =>
  withSession<SessionParams, SessionView>(ctx, (session) =>
    ctx.sessionView.build(session)
  );

/** What the wrap-up route supplies. */
interface EndCallRequest {
  params: { id: string; callId: string };
  body: EndCallBody;
}

/**
 * Wraps up the connected call so the agent's line frees.
 *
 * @param ctx the app context
 * @returns a handler resolving to the updated session
 */
export const endCall = (ctx: AppContext) =>
  withSession<EndCallRequest, DialerSession | undefined>(ctx, (session, request) => {
    if (session.winnerCallId !== request.params.callId) {
      throw new AppError(
        409,
        ERR.CALL.NOT_ACTIVE,
        'That call is not the one currently holding the agent'
      );
    }

    ctx.dialer.endCall(session.id, request.params.callId, request.body);
    return ctx.sessions.findById(session.id);
  });
