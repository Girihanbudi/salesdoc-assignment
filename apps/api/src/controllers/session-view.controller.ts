import type { DialerSession, LineView, SessionView } from '@salesdoc/shared';
import type { ActivitiesRepository } from '../repositories/activities.repository.js';
import type { CallsRepository } from '../repositories/calls.repository.js';
import type { CrmRepository } from '../repositories/crm.repository.js';
import type { LeadsRepository } from '../repositories/leads.repository.js';

/** What {@link createSessionViewController} needs to do its job. */
export interface SessionViewControllerDeps {
  leads: LeadsRepository;
  calls: CallsRepository;
  activities: ActivitiesRepository;
  crm: CrmRepository;
}

/** Assembles the payload the dashboard polls. */
export interface SessionViewController {
  build: (session: DialerSession) => SessionView;
}

/**
 * Builds the session-view controller.
 *
 * Hydration lives here rather than in a handler because it is a domain
 * question — what the agent needs to see — not an HTTP one. The result is
 * fully joined so the client never has to match calls to leads itself.
 *
 * @param deps the repositories it reads from
 * @returns the controller
 */
export function createSessionViewController(
  deps: SessionViewControllerDeps
): SessionViewController {
  /**
   * Hydrates a call with its lead and CRM sync state.
   *
   * @param callId the call to render
   * @returns the line view, or null if the call or its lead is missing
   */
  function toLineView(callId: string): LineView | null {
    const call = deps.calls.findById(callId);
    if (!call) return null;
    const lead = deps.leads.findById(call.leadId);
    if (!lead) return null;
    return { call, lead, crmSyncStatus: deps.crm.getSyncStatus(callId) ?? null };
  }

  return {
    build(session) {
      const history = deps.calls
        .findBySessionId(session.id)
        .map((call) => toLineView(call.id))
        .filter((line): line is LineView => line !== null)
        .reverse();

      return {
        session,
        lines: session.activeCallIds
          .map(toLineView)
          .filter((line): line is LineView => line !== null),
        winner: session.winnerCallId === null ? null : toLineView(session.winnerCallId),
        history,
        upNext: session.leadQueue
          .map((leadId) => deps.leads.findById(leadId))
          .filter((lead) => lead !== undefined),
        activities: deps.activities.findByCallIds(history.map((line) => line.call.id)),
      };
    },
  };
}
