import { useCallback } from 'react';
import * as api from '@/api.js';
import { usePoll } from '@/hooks/usePoll.js';

/** What {@link useActiveSession} hands back. */
export interface ActiveSession {
  /** The session this agent has running, or null when there is none. */
  sessionId: string | null;
  /** Re-asks the server. Call after starting or finishing a session. */
  refresh: () => void;
}

/**
 * Asks the server which session is running.
 *
 * Previously this was remembered in `localStorage`, which was wrong in three
 * ways: the id went stale whenever the process restarted (in-memory state, so
 * every deploy), it was invisible to a second tab, and it could offer "resume"
 * on a session that no longer existed. The server already knows, and it is the
 * only thing that can be right.
 *
 * Fetched once per load rather than polled — a session only starts or ends
 * through actions this app takes, and those call `refresh`.
 *
 * @returns the running session id and a way to re-ask
 */
export function useActiveSession(): ActiveSession {
  const active = usePoll(useCallback(() => api.getActiveSession(), []), 0);

  return {
    sessionId: active.data?.id ?? null,
    refresh: active.refresh,
  };
}
