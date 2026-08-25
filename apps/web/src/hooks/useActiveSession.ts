import { useCallback, useState } from 'react';

/**
 * Where this browser remembers the session it started.
 *
 * The URL owns which screen you are on, but leaving the dialer drops the id
 * from it. This is what lets the app offer a way back, and what tells the
 * dashboard which session is *yours* rather than merely the newest on the
 * server.
 */
const STORAGE_KEY = 'salesdoc:active-session';

/** What {@link useActiveSession} hands back. */
export interface ActiveSession {
  /** The session this browser started and that has not finished yet. */
  sessionId: string | null;
  /** Records a session as active. Called the moment one starts. */
  remember: (sessionId: string) => void;
  /** Clears it — the session finished, was stopped, or no longer exists. */
  forget: () => void;
}

/**
 * Reads the remembered session id.
 *
 * Every access is guarded: storage throws in private mode and in some embedded
 * browsers, and resuming a session is a convenience that must never stop the
 * app booting.
 *
 * @returns the id, or null when there is none or storage is unavailable
 */
function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Tracks the one session this browser has running.
 *
 * Held in state as well as storage so a change re-renders; storage alone would
 * leave the UI showing a session that has already finished.
 *
 * @returns the active session id and the two ways to change it
 */
export function useActiveSession(): ActiveSession {
  const [sessionId, setSessionId] = useState<string | null>(read);

  const remember = useCallback((id: string) => {
    setSessionId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // See read(): storage is optional, the app is not.
    }
  }, []);

  const forget = useCallback(() => {
    setSessionId(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* see above */
    }
  }, []);

  return { sessionId, remember, forget };
}
