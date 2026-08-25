import { CONCURRENCY, type DialerSession } from '@salesdoc/shared';
import type { Store } from '../db/store.js';

/** Queries and writes against dialer sessions. */
export interface SessionsRepository {
  findById: (id: string) => DialerSession | undefined;
  exists: (id: string) => boolean;
  save: (session: DialerSession) => void;
  /** Inserts a new session in the STOPPED state and returns it. */
  create: (id: string, agentId: string, leadIds: readonly string[]) => DialerSession;
}

/**
 * Builds the sessions repository.
 *
 * @param store the database
 * @returns the repository
 */
export function createSessionsRepository(store: Store): SessionsRepository {
  return {
    findById: (id) => store.sessions.get(id),
    exists: (id) => store.sessions.has(id),
    save: (session) => {
      store.sessions.set(session.id, session);
    },
    create: (id, agentId, leadIds) => {
      const session: DialerSession = {
        id,
        agentId,
        leadQueue: [...leadIds],
        concurrency: CONCURRENCY,
        activeCallIds: [],
        winnerCallId: null,
        status: 'STOPPED',
        metrics: { attempted: 0, connected: 0, failed: 0, canceled: 0 },
      };
      store.sessions.set(id, session);
      return session;
    },
  };
}
