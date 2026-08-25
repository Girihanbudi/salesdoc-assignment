import type { CRMActivity, CRMContact, CrmSyncStatus } from '@salesdoc/shared';
import type { Store } from '../db/store.js';

/**
 * The mock CRM's own tables, plus our per-call sync bookkeeping.
 *
 * The contact and activity tables belong to the pretend external system; the
 * sync status and idempotency keys are ours. They share a repository because
 * they share a store, but `mocks/mock-crm.client.ts` is the only thing that
 * should touch the first two.
 */
export interface CrmRepository {
  findContact: (id: string) => CRMContact | undefined;
  saveContact: (contact: CRMContact) => void;
  findAllContacts: () => CRMContact[];

  saveActivity: (activity: CRMActivity) => void;
  findAllActivities: () => CRMActivity[];

  /** True when this call has already produced an activity. */
  hasSynced: (callId: string) => boolean;
  /** Claims the idempotency key for a call. */
  markSynced: (callId: string) => void;

  getSyncStatus: (callId: string) => CrmSyncStatus | undefined;
  setSyncStatus: (callId: string, status: CrmSyncStatus) => void;
}

/**
 * Builds the CRM repository.
 *
 * @param store the database
 * @returns the repository
 */
export function createCrmRepository(store: Store): CrmRepository {
  return {
    findContact: (id) => store.crmContacts.get(id),
    saveContact: (contact) => {
      store.crmContacts.set(contact.id, contact);
    },
    findAllContacts: () => [...store.crmContacts.values()],

    saveActivity: (activity) => {
      store.crmActivities.set(activity.id, activity);
    },
    findAllActivities: () => [...store.crmActivities.values()],

    hasSynced: (callId) => store.syncedCallIds.has(callId),
    markSynced: (callId) => {
      store.syncedCallIds.add(callId);
    },

    getSyncStatus: (callId) => store.crmSyncStatus.get(callId),
    setSyncStatus: (callId, status) => {
      store.crmSyncStatus.set(callId, status);
    },
  };
}
