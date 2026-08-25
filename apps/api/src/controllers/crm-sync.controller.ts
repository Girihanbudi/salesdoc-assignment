import type { Call, Disposition } from '@salesdoc/shared';
import { AUTO_DISPOSITION, AUTO_NOTES } from '../constant/crm.js';
import { contactFromLead, type MockCrmClient } from '../mocks/mock-crm.client.js';
import type { ActivitiesRepository } from '../repositories/activities.repository.js';
import type { CrmRepository } from '../repositories/crm.repository.js';
import type { LeadsRepository } from '../repositories/leads.repository.js';
import type { Clock } from '../utils/clock.js';

/** The agent's wrap-up, when there was one. */
export interface CallOutcome {
  disposition: Disposition;
  notes: string;
}

/** What {@link createCrmSyncController} needs to do its job. */
export interface CrmSyncControllerDeps {
  leads: LeadsRepository;
  activities: ActivitiesRepository;
  crm: CrmRepository;
  client: MockCrmClient;
  clock: Clock;
}

/** Writes terminal calls to the CRM, exactly once each. */
export interface CrmSyncController {
  sync: (call: Call, outcome?: CallOutcome) => void;
}

/**
 * Builds the CRM sync controller.
 *
 * Owns the idempotency guard and the choice of disposition. It does not know
 * how the CRM stores anything — that is `mocks/mock-crm.client.ts`, which a
 * real vendor client would replace.
 *
 * @param deps repositories, the CRM client, and the clock
 * @returns the controller
 */
export function createCrmSyncController(deps: CrmSyncControllerDeps): CrmSyncController {
  return {
    sync(call, outcome) {
      // Claimed BEFORE the deferred write, so two events racing in the same
      // tick cannot both pass the guard.
      if (deps.crm.hasSynced(call.id)) return;
      deps.crm.markSynced(call.id);

      deps.crm.setSyncStatus(call.id, 'pending');

      // Deferred by a simulated network latency so the per-call sync state
      // passes through `pending` — the UI is required to show that, and an
      // in-process call would otherwise settle in the same tick.
      deps.clock.schedule(() => {
        const lead = deps.leads.findById(call.leadId);
        if (!lead) {
          deps.crm.setSyncStatus(call.id, 'failed');
          return;
        }

        const contact = deps.client.upsertContact(contactFromLead(lead));
        if (lead.crmExternalId === undefined) {
          deps.leads.attachCrmExternalId(lead.id, contact.id);
        }

        const activity = deps.client.createActivity(
          {
            crmExternalId: contact.id,
            leadId: lead.id,
            callId: call.id,
            disposition: outcome?.disposition ?? AUTO_DISPOSITION[call.status] ?? 'CANCELED',
            notes: outcome?.notes || (AUTO_NOTES[call.status] ?? ''),
          },
          deps.clock.id()
        );

        // The brief requires the activity in our store as well as the CRM's.
        deps.activities.save(activity);
        deps.crm.setSyncStatus(call.id, 'synced');
      }, deps.client.latencyMs());
    },
  };
}
