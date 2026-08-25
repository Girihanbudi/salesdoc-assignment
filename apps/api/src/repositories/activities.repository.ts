import type { CRMActivity } from '@salesdoc/shared';
import type { Store } from '../db/store.js';

/** Queries and writes against our own record of CRM activities. */
export interface ActivitiesRepository {
  /** Every activity, newest first. */
  findAll: () => CRMActivity[];
  findByCallId: (callId: string) => CRMActivity | undefined;
  findByLeadId: (leadId: string) => CRMActivity[];
  /** Activities for the given calls, newest first. */
  findByCallIds: (callIds: readonly string[]) => CRMActivity[];
  save: (activity: CRMActivity) => void;
}

/**
 * Builds the activities repository.
 *
 * @param store the database
 * @returns the repository
 */
export function createActivitiesRepository(store: Store): ActivitiesRepository {
  return {
    findAll: () =>
      [...store.activities.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    findByCallId: (callId) =>
      [...store.activities.values()].find((activity) => activity.callId === callId),

    findByLeadId: (leadId) =>
      [...store.activities.values()].filter((activity) => activity.leadId === leadId),

    findByCallIds: (callIds) => {
      const wanted = new Set(callIds);
      return [...store.activities.values()]
        .filter((activity) => wanted.has(activity.callId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    save: (activity) => {
      store.activities.set(activity.id, activity);
    },
  };
}
