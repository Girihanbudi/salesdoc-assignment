import { CONCURRENCY } from '@salesdoc/shared';
import type {
  Call,
  CRMActivity,
  CRMContact,
  CrmSyncStatus,
  DialerSession,
  Lead,
} from '@salesdoc/shared';

/**
 * In-memory persistence. The assignment permits this explicitly; the tradeoff
 * is that everything resets when the process restarts, which on Render's free
 * tier happens after ~15 minutes of inactivity. Documented in NOTES.md.
 */
export interface Store {
  leads: Map<string, Lead>;
  calls: Map<string, Call>;
  sessions: Map<string, DialerSession>;
  /** Our own record of what was written to the CRM. */
  activities: Map<string, CRMActivity>;
  /** Stands in for the external CRM's own database. */
  crmContacts: Map<string, CRMContact>;
  crmActivities: Map<string, CRMActivity>;
  /** Per-call CRM write state, surfaced per line in the UI. */
  crmSyncStatus: Map<string, CrmSyncStatus>;
  /** Idempotency keys. A callId in here has already produced an activity. */
  syncedCallIds: Set<string>;
}

/**
 * Six leads, as the brief allows 4-8.
 *
 * Four deliberately have no `crmExternalId` and two do, so the "create the
 * contact before the activity" branch is exercised on the very first run and
 * is visible in the demo rather than only in a test.
 */
const SEED_LEADS: readonly Lead[] = [
  {
    id: 'lead-1',
    name: 'Amara Osei',
    company: 'Northwind Logistics',
    phone: '+1 415 555 0142',
    email: 'amara.osei@northwind-logistics.com',
  },
  {
    id: 'lead-2',
    name: 'Rafael Moreno',
    company: 'Cobalt Health',
    phone: '+1 415 555 0177',
    email: 'r.moreno@cobalthealth.io',
    crmExternalId: 'crm-contact-88213',
  },
  {
    id: 'lead-3',
    name: 'Priya Raghunathan',
    company: 'Meridian Textiles',
    phone: '+65 6555 0193',
    email: 'priya.r@meridiantextiles.sg',
  },
  {
    id: 'lead-4',
    name: 'Tomas Lindqvist',
    company: 'Arboreal Energy',
    phone: '+46 8 555 0116',
    email: 'tomas@arboreal.energy',
  },
  {
    id: 'lead-5',
    name: 'Chen Wei',
    company: 'Lantern Robotics',
    phone: '+1 206 555 0158',
    email: 'chen.wei@lanternrobotics.com',
    crmExternalId: 'crm-contact-88214',
  },
  {
    id: 'lead-6',
    name: 'Nadia Haddad',
    company: 'Sable Financial',
    phone: '+971 4 555 0121',
    email: 'n.haddad@sablefinancial.ae',
  },
];

/**
 * Builds an empty store seeded with leads.
 *
 * Returns a fresh instance rather than a module-level singleton so each test
 * gets isolated state without needing a reset hook.
 *
 * @returns a store ready to use
 */
export function createStore(): Store {
  return {
    leads: new Map(SEED_LEADS.map((lead) => [lead.id, { ...lead }])),
    calls: new Map(),
    sessions: new Map(),
    activities: new Map(),
    crmContacts: new Map(),
    crmActivities: new Map(),
    crmSyncStatus: new Map(),
    syncedCallIds: new Set(),
  };
}

/**
 * Builds a session in the STOPPED state, ready for the dialer to start.
 *
 * @param id the session id
 * @param agentId the agent who will work the queue
 * @param leadIds leads to dial, in order
 * @returns the new session
 */
export function createSession(
  id: string,
  agentId: string,
  leadIds: readonly string[]
): DialerSession {
  return {
    id,
    agentId,
    leadQueue: [...leadIds],
    concurrency: CONCURRENCY,
    activeCallIds: [],
    winnerCallId: null,
    status: 'STOPPED',
    metrics: { attempted: 0, connected: 0, failed: 0, canceled: 0 },
  };
}
