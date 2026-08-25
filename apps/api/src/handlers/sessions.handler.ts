import type {
  CreateSessionBody,
  DialerSession,
  EndCallBody,
  SessionView,
} from '@salesdoc/shared';
import { ERR } from '../constant/error-codes.js';
import type { AppContext } from '../types/context.js';
import { AppError } from '../utils/AppError.js';
import { withSession } from '../utils/with-entity.js';

/**
 * Creates a session over the selected leads.
 *
 * Shape validation already happened in the route schema, so the only check
 * left is the one that needs the database: do these leads exist?
 *
 * @param ctx the app context
 * @returns a handler resolving to the new session
 */
export const create =
  (ctx: AppContext) =>
  (request: { body: CreateSessionBody }): DialerSession => {
    const missing = ctx.leads.findMissingIds(request.body.leadIds);
    if (missing.length > 0) {
      throw new AppError(400, ERR.LEAD.UNKNOWN, `No such lead: ${missing.join(', ')}`);
    }

    return ctx.sessions.create(
      `session-${ctx.id()}`,
      request.body.agentId,
      request.body.leadIds
    );
  };

/**
 * Begins dialing a session.
 *
 * @param ctx the app context
 * @returns a handler resolving to the updated session
 */
export const start = (ctx: AppContext) =>
  withSession<{ params: { id: string } }, DialerSession | undefined>(ctx, (session) => {
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
  withSession<{ params: { id: string } }, DialerSession | undefined>(ctx, (session) => {
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
  withSession<{ params: { id: string } }, SessionView>(ctx, (session) =>
    ctx.sessionView.build(session)
  );

/**
 * Wraps up the connected call so the agent's line frees.
 *
 * @param ctx the app context
 * @returns a handler resolving to the updated session
 */
export const endCall = (ctx: AppContext) =>
  withSession<{ params: { id: string; callId: string }; body: EndCallBody }, DialerSession | undefined>(
    ctx,
    (session, request) => {
      if (session.winnerCallId !== request.params.callId) {
        throw new AppError(
          409,
          ERR.CALL.NOT_ACTIVE,
          'That call is not the one currently holding the agent'
        );
      }

      ctx.dialer.endCall(session.id, request.params.callId, request.body);
      return ctx.sessions.findById(session.id);
    }
  );
