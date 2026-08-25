import type { ActivityDetail, CRMActivity } from '@salesdoc/shared';
import { ERR } from '../constant/error-codes.js';
import type { AppContext } from '../types/context.js';
import { AppError } from '../utils/AppError.js';

/**
 * Lists every CRM activity we have written, newest first.
 *
 * @param ctx the app context
 * @returns a handler resolving to the activities
 */
export const list =
  (ctx: AppContext) =>
  (): CRMActivity[] =>
    ctx.activities.findAll();

/**
 * One activity, hydrated with the lead and call it concerns.
 *
 * Keyed by `callId` rather than the activity id: the call is what the agent
 * saw, and it is the idempotency key, so it is the stable handle.
 *
 * @param ctx the app context
 * @returns a handler resolving to the detail
 */
export const detail =
  (ctx: AppContext) =>
  (request: { params: { callId: string } }): ActivityDetail => {
    const activity = ctx.activities.findByCallId(request.params.callId);
    if (!activity) {
      throw new AppError(404, ERR.ACTIVITY.NOT_FOUND, 'No activity for that call');
    }

    const lead = ctx.leads.findById(activity.leadId);
    if (!lead) {
      throw new AppError(404, ERR.LEAD.NOT_FOUND, 'The lead for that activity is gone');
    }

    return { activity, lead, call: ctx.calls.findById(activity.callId) ?? null };
  };
