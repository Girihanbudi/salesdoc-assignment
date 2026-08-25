import type { Lead } from '@salesdoc/shared';
import type { Store } from '../db/store.js';

/** Queries and writes against leads. */
export interface LeadsRepository {
  findAll: () => Lead[];
  findById: (id: string) => Lead | undefined;
  existsById: (id: string) => boolean;
  /** Returns every id in `ids` that has no matching lead. */
  findMissingIds: (ids: readonly string[]) => string[];
  /** Links a lead to its mock-CRM contact once one exists. */
  attachCrmExternalId: (leadId: string, crmExternalId: string) => void;
}

/**
 * Builds the leads repository.
 *
 * @param store the database
 * @returns the repository
 */
export function createLeadsRepository(store: Store): LeadsRepository {
  return {
    findAll: () => [...store.leads.values()],
    findById: (id) => store.leads.get(id),
    existsById: (id) => store.leads.has(id),
    findMissingIds: (ids) => ids.filter((id) => !store.leads.has(id)),
    attachCrmExternalId: (leadId, crmExternalId) => {
      const lead = store.leads.get(leadId);
      if (!lead) return;
      store.leads.set(leadId, { ...lead, crmExternalId });
    },
  };
}
