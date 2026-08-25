import type { Disposition } from '@salesdoc/shared';
import { useCallback, useState } from 'react';
import * as api from '@/api.js';
import { Dashboard } from '@/components/Dashboard.js';
import { LeadPicker } from '@/components/LeadPicker.js';
import { Button } from '@/components/ui/button.js';
import { usePoll } from '@/hooks/usePoll.js';

/** How often the dashboard refreshes. The brief asks for 1-2s. */
const POLL_MS = 1500;

/**
 * Root component. Two screens, no router — the dashboard renders once a
 * session exists, the lead picker before that.
 */
export function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const leads = usePoll(api.getLeads, 10_000, sessionId === null);
  const view = usePoll(
    useCallback(
      () => api.getSessionView(sessionId ?? ''),
      [sessionId]
    ),
    POLL_MS,
    sessionId !== null
  );

  const start = async (leadIds: string[]): Promise<void> => {
    setBusy(true);
    setActionError(null);
    try {
      const session = await api.createSession(leadIds);
      await api.startSession(session.id);
      setSessionId(session.id);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not start session');
    } finally {
      setBusy(false);
    }
  };

  const endCall = async (
    callId: string,
    outcome: { disposition: Disposition; notes: string }
  ): Promise<void> => {
    if (sessionId === null) return;
    setBusy(true);
    try {
      await api.endCall(sessionId, callId, outcome);
      view.refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not end the call');
    } finally {
      setBusy(false);
    }
  };

  const stop = async (): Promise<void> => {
    if (sessionId === null) return;
    setBusy(true);
    try {
      await api.stopSession(sessionId);
      view.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">
          {sessionId === null ? 'Start a dialer session' : 'Dialer session'}
        </h1>
        <p className="mt-2 text-muted">
          {sessionId === null
            ? 'Two lines dial at once. The first lead to answer takes the agent.'
            : 'Polling every 1.5s. Wrap up the live call to resume dialing.'}
        </p>
      </header>

      {sessionId === null ? (
        <Screen state={leads} emptyMessage="No leads found.">
          {(data) => (
            <LeadPicker leads={data} onStart={start} busy={busy} error={actionError} />
          )}
        </Screen>
      ) : (
        <Screen state={view} emptyMessage="Session not found.">
          {(data) => (
            <Dashboard
              view={data}
              onEndCall={endCall}
              onStop={stop}
              onReset={() => setSessionId(null)}
              busy={busy}
            />
          )}
        </Screen>
      )}
    </div>
  );
}

/**
 * Renders the loading, error, and empty states around polled data.
 *
 * Every async view needs all three, and a failed fetch must not look like an
 * empty result.
 *
 * @param props the poll state, an empty message, and the success renderer
 * @returns whichever state currently applies
 */
function Screen<T>({
  state,
  emptyMessage,
  children,
}: {
  state: { data: T | null; error: string | null; loading: boolean; refresh: () => void };
  emptyMessage: string;
  children: (data: T) => React.ReactNode;
}) {
  if (state.loading) {
    return (
      <p className="py-20 text-center text-muted" role="status">
        Loading… If this is the first request in a while, the free-tier server is
        waking up and may take ~30s.
      </p>
    );
  }

  if (state.error !== null && state.data === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-neg">{state.error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={state.refresh}>
          Retry
        </Button>
      </div>
    );
  }

  if (state.data === null) {
    return <p className="py-20 text-center text-muted">{emptyMessage}</p>;
  }

  return <>{children(state.data)}</>;
}
