import type { DialerSession } from '@salesdoc/shared';
import { ERR } from '../constant/error-codes.js';
import type { AppContext } from '../types/context.js';
import { AppError } from './AppError.js';

/** The slice of a request these wrappers read. */
interface WithParams {
  params: { id: string };
}

/**
 * Loads the session named by `:id`, or throws a 404.
 *
 * Replaces the load-null-check-envelope block that was repeated in four
 * handlers. `AppError` reaches the error handler, which is the only place that
 * builds a response body.
 *
 * @param ctx the app context
 * @param fn what to do once the session is known to exist
 * @returns a handler that resolves the session first
 */
export function withSession<Req extends WithParams, T>(
  ctx: AppContext,
  fn: (session: DialerSession, request: Req) => T
) {
  return (request: Req): T => {
    const session = ctx.sessions.findById(request.params.id);
    if (!session) {
      throw new AppError(404, ERR.SESSION.NOT_FOUND, 'No such session');
    }
    return fn(session, request);
  };
}

/**
 * Ensures the lead named by `:id` exists, or throws a 404.
 *
 * @param ctx the app context
 * @param fn what to do once the lead is known to exist
 * @returns a handler that checks the lead first
 */
export function withLead<Req extends WithParams, T>(
  ctx: AppContext,
  fn: (leadId: string, request: Req) => T
) {
  return (request: Req): T => {
    const leadId = request.params.id;
    if (!ctx.leads.existsById(leadId)) {
      throw new AppError(404, ERR.LEAD.NOT_FOUND, 'No such lead');
    }
    return fn(leadId, request);
  };
}
