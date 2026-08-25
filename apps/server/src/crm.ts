import type { Call, CRMActivity, CRMContact, Disposition, Lead } from '@salesdoc/shared';
import type { Store } from './store.js';

/** Injected so tests can drive time and ids deterministically. */
export interface CrmDeps {
  store: Store;
  /** Current time as an ISO-8601 string. */
  now: () => string;
  /** Unique id generator. */
  id: () => string;
  /** Deferred execution. Real code passes setTimeout. */
  schedule: (fn: () => void, ms: number) => void;
  /** Simulated round-trip to the "external" CRM, in ms. */
  latencyMs: () => number;
}

/** Maps a terminal call outcome to the disposition recorded against it. */
const AUTO_DISPOSITION: Record<string, Disposition> = {
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  VOICEMAIL: 'VOICEMAIL',
  CANCELED_BY_DIALER: 'CANCELED',
};

/** Human-readable note for an outcome the agent never handled. */
const AUTO_NOTES: Record<string, string> = {
  NO_ANSWER: 'No answer. Line rang out with no pickup.',
  BUSY: 'Busy signal. Line engaged.',
  VOICEMAIL: 'Reached voicemail. No message left.',
  CANCELED_BY_DIALER:
    'Canceled by dialer — another line on this session connected first.',
};

/**
 * Creates or updates the contact backing a lead in the mock CRM.
 *
 * The brief requires that a lead without a `crmExternalId` gets a contact
 * before any activity is written, so the activity always has something to
 * attach to.
 *
 * @param deps injected store, clock, and id generator
 * @param lead the lead to mirror into the CRM; mutated with the new id
 * @returns the contact's id, which the lead stores as `crmExternalId`
 */
export function upsertContact(deps: CrmDeps, lead: Lead): string {
  const existingId = lead.crmExternalId;
  const timestamp = deps.now();

  if (existingId !== undefined) {
    const existing = deps.store.crmContacts.get(existingId);
    const contact: CRMContact = {
      id: existingId,
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    deps.store.crmContacts.set(existingId, contact);
    return existingId;
  }

  const id = `crm-contact-${deps.id()}`;
  deps.store.crmContacts.set(id, {
    id,
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Write the id back so the next sync for this lead reuses the contact.
  lead.crmExternalId = id;
  deps.store.leads.set(lead.id, lead);
  return id;
}

/**
 * Writes a terminal call to the CRM exactly once.
 *
 * Idempotency key is the `callId`, per the brief: replaying the same terminal
 * event must not produce a second activity. The guard is claimed *before* the
 * deferred write so two events racing in the same tick cannot both pass it.
 *
 * The write is deferred by a simulated network latency so the per-call sync
 * state passes through `pending` — the UI is required to show that, and an
 * in-process call would otherwise settle in the same tick.
 *
 * @param deps injected store, clock, id generator, and scheduler
 * @param call the call that reached a terminal status
 * @param outcome disposition and notes; supplied by the agent for a connected
 *   call, derived from the status otherwise
 * @param outcome.disposition
 * @param outcome.notes
 */
export function syncToCrm(
  deps: CrmDeps,
  call: Call,
  outcome?: { disposition: Disposition; notes: string }
): void {
  if (deps.store.syncedCallIds.has(call.id)) return;
  deps.store.syncedCallIds.add(call.id);

  deps.store.crmSyncStatus.set(call.id, 'pending');

  deps.schedule(() => {
    const lead = deps.store.leads.get(call.leadId);
    if (!lead) {
      deps.store.crmSyncStatus.set(call.id, 'failed');
      return;
    }

    const crmExternalId = upsertContact(deps, lead);

    const activity: CRMActivity = {
      id: `activity-${deps.id()}`,
      leadId: lead.id,
      crmExternalId,
      type: 'CALL',
      callId: call.id,
      disposition: outcome?.disposition ?? AUTO_DISPOSITION[call.status] ?? 'CANCELED',
      notes: outcome?.notes || (AUTO_NOTES[call.status] ?? ''),
      createdAt: deps.now(),
    };

    // The brief requires the activity in both our own store and the mock CRM.
    deps.store.activities.set(activity.id, activity);
    deps.store.crmActivities.set(activity.id, activity);
    deps.store.crmSyncStatus.set(call.id, 'synced');
  }, deps.latencyMs());
}
