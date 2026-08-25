import type {
  Agent,
  Call,
  CRMActivity,
  CRMContact,
  CrmSyncStatus,
  DialerSession,
  Lead,
} from '@salesdoc/shared';
import { SEED_AGENT, SEED_LEADS } from './seed.js';

/**
 * The database. It happens to be in memory, which the assignment permits, and
 * the tradeoff is that everything resets on restart — on Render's free tier,
 * after ~15 minutes idle. Documented in NOTES.md.
 *
 * Only `repositories/` may import this. Every Map operation here is a query,
 * and queries belong behind a repository so they can be named, tested, and one
 * day pointed at Postgres.
 */
export interface Store {
  /** The one signed-in agent. No auth, so no map. */
  agent: Agent;
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
 * Builds an empty store seeded with leads.
 *
 * Returns a fresh instance rather than a module-level singleton so each test
 * gets isolated state without needing a reset hook.
 *
 * @returns a store ready to use
 */
export function createStore(): Store {
  return {
    agent: { ...SEED_AGENT },
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
