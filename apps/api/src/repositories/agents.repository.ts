import type { Agent } from '@salesdoc/shared';
import type { Store } from '../db/store.js';

/** Reads against the signed-in agent. */
export interface AgentsRepository {
  /** The one agent this app runs as. */
  findCurrent: () => Agent;
}

/**
 * Builds the agents repository.
 *
 * A repository for a single record looks like overkill, but the layering rule
 * has no exceptions: nothing above this may touch the store, and when auth
 * arrives this is the one file that changes.
 *
 * @param store the database
 * @returns the repository
 */
export function createAgentsRepository(store: Store): AgentsRepository {
  return {
    findCurrent: () => store.agent,
  };
}
