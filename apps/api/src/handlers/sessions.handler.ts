import type {
  CreateSessionBody,
  DialerSession,
  EndCallBody,
  LineView,
  SessionDetail,
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
    // One agent cannot work two sessions at once. Four lines would be dialing
    // for one person, and both sessions could elect a winner in the same
    // moment — the exact collision the winner election exists to prevent.
    const running = ctx.sessions.findRunningByAgent(request.body.agentId);
    if (running) {
      throw new AppError(
        409,
        ERR.AGENT.BUSY,
        'That agent already has a session running',
        [{ path: 'agentId', message: `Session ${running.id} is still dialing` }]
      );
    }

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
 * Hangs up the connected call early.
 *
 * The mocked conversation ends on its own, so this only brings that forward.
 * The CRM write is identical either way: the disposition is derived from how
 * the call ended, not chosen by whoever called this.
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

    ctx.dialer.endCall(session.id, request.params.callId);
    return ctx.sessions.findById(session.id);
  });

/**
 * Every session this process has seen, newest first.
 *
 * @param ctx the app context
 * @returns a handler resolving to the session history
 */
export const list =
  (ctx: AppContext) =>
  (): DialerSession[] =>
    ctx.sessions.findAll();

/**
 * One session with every call it placed and every activity it wrote.
 *
 * Separate from the poll endpoint: that one is tuned for a live dashboard,
 * this one is the after-the-fact log.
 *
 * @param ctx the app context
 * @returns a handler resolving to the session detail
 */
export const detail = (ctx: AppContext) =>
  withSession<SessionParams, SessionDetail>(ctx, (session) => {
    const calls: LineView[] = ctx.calls
      .findBySessionId(session.id)
      .reverse()
      .map((call) => ({
        call,
        lead: ctx.leads.findById(call.leadId),
        crmSyncStatus: ctx.crm.getSyncStatus(call.id) ?? null,
      }))
      .filter((line): line is LineView => line.lead !== undefined);

    return {
      session,
      calls,
      activities: ctx.activities.findByCallIds(calls.map((line) => line.call.id)),
    };
  });

/**
 * The session this agent has running, or null.
 *
 * The client asks on load rather than remembering across reloads: the server
 * is the only thing that knows whether a session is still going, and an id
 * kept in the browser goes stale the moment the process restarts.
 *
 * @param ctx the app context
 * @returns a handler resolving to the running session, or null
 */
export const active =
  (ctx: AppContext) =>
  (): DialerSession | null =>
    ctx.sessions.findRunningByAgent(ctx.agents.findCurrent().id) ?? null;
