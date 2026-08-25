import type { CrmSyncController } from '../controllers/crm-sync.controller.js';
import type { Dialer } from '../controllers/dialer.controller.js';
import type { SessionViewController } from '../controllers/session-view.controller.js';
import type { ActivitiesRepository } from '../repositories/activities.repository.js';
import type { AgentsRepository } from '../repositories/agents.repository.js';
import type { CallsRepository } from '../repositories/calls.repository.js';
import type { CrmRepository } from '../repositories/crm.repository.js';
import type { LeadsRepository } from '../repositories/leads.repository.js';
import type { SessionsRepository } from '../repositories/sessions.repository.js';

/**
 * Everything a handler is allowed to reach.
 *
 * Assembled once in `container.ts`, then threaded through routes to handlers.
 * A handler receiving this cannot reach the store directly — that is the point.
 */
export interface AppContext {
  agents: AgentsRepository;
  leads: LeadsRepository;
  calls: CallsRepository;
  sessions: SessionsRepository;
  activities: ActivitiesRepository;
  crm: CrmRepository;
  dialer: Dialer;
  crmSync: CrmSyncController;
  sessionView: SessionViewController;
  /** Short unique id, for entities created at the HTTP boundary. */
  id: () => string;
}
