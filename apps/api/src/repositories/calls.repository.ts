import type { Call } from '@salesdoc/shared';
import type { Store } from '../db/store.js';

/** Queries and writes against calls. */
export interface CallsRepository {
  findById: (id: string) => Call | undefined;
  /** Every call placed in a session, oldest first. */
  findBySessionId: (sessionId: string) => Call[];
  save: (call: Call) => void;
}

/**
 * Builds the calls repository.
 *
 * @param store the database
 * @returns the repository
 */
export function createCallsRepository(store: Store): CallsRepository {
  return {
    findById: (id) => store.calls.get(id),
    findBySessionId: (sessionId) =>
      [...store.calls.values()].filter((call) => call.sessionId === sessionId),
    save: (call) => {
      store.calls.set(call.id, call);
    },
  };
}
