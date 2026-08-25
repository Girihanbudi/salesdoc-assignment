import type { Disposition } from '@salesdoc/shared';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api.js';
import { CrmView } from '@/components/CrmView.js';
import { Dashboard } from '@/components/Dashboard.js';
import { LeadPicker } from '@/components/LeadPicker.js';
import { Shell, type View } from '@/components/Shell.js';
import { Button } from '@/components/ui/button.js';
import { Snackbar } from '@/components/ui/snackbar.js';
import { usePoll } from '@/hooks/usePoll.js';
import { useToasts } from '@/hooks/useToasts.js';
import { toUserMessage } from '@/lib/fetcher.js';

/** How often the dashboard refreshes. The brief asks for 1-2s. */
const POLL_MS = 1500;
/** The CRM screen is not live-critical, so it polls lazily. */
const CRM_POLL_MS = 4000;

/**
 * Root component.
 *
 * Failures surface as a bottom-left snackbar rather than inline text: a poll
 * failing every 1.5s must not shove the layout around, and an action failing
 * needs to be seen even when the pointer is elsewhere. Every message comes
 * from `toUserMessage`, so no screen invents its own wording.
 */
export function App() {
  const [view, setView] = useState<View>('dialer');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const onDialer = view === 'dialer';

  const leads = usePoll(api.getLeads, 10_000, onDialer && sessionId === null);
  const session = usePoll(
    useCallback(() => api.getSessionView(sessionId ?? ''), [sessionId]),
    POLL_MS,
    onDialer && sessionId !== null
  );
  const contacts = usePoll(api.getCrmContacts, CRM_POLL_MS, view === 'crm');
  const activities = usePoll(api.getCrmActivities, CRM_POLL_MS, view === 'crm');

  /**
   * Reports a thrown value as a snackbar.
   *
   * @param cause whatever was thrown
   * @param fallback context wording, used only when the code is unrecognised
   */
  const report = useCallback(
    (cause: unknown, fallback: string) => {
      const { title, detail } = toUserMessage(cause, fallback);
      push('error', title, detail);
    },
    [push]
  );

  // Poll failures are reported once each, not on every tick: useToasts drops a
  // duplicate that is already on screen.
  const pollFailure = onDialer
    ? sessionId === null
      ? leads.error
      : session.error
    : (contacts.error ?? activities.error);

  useEffect(() => {
    if (pollFailure === null) return;
    const { title, detail } = toUserMessage(pollFailure);
    push('error', title, detail);
  }, [pollFailure, push]);

  const start = async (leadIds: string[]): Promise<void> => {
    setBusy(true);
    try {
      const created = await api.createSession(leadIds);
      await api.startSession(created.id);
      setSessionId(created.id);
      push('success', `Dialing ${String(leadIds.length)} leads`, 'Two lines at a time.');
    } catch (cause) {
      report(cause, 'Could not start the session');
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
      session.refresh();
      push('success', 'Call wrapped up', 'Written to the CRM.');
    } catch (cause) {
      report(cause, 'Could not end the call');
    } finally {
      setBusy(false);
    }
  };

  const stop = async (): Promise<void> => {
    if (sessionId === null) return;
    setBusy(true);
    try {
      await api.stopSession(sessionId);
      session.refresh();
      push('info', 'Session stopped', 'Active calls were cancelled.');
    } catch (cause) {
      report(cause, 'Could not stop the session');
    } finally {
      setBusy(false);
    }
  };

  const heading = !onDialer
    ? {
        title: 'CRM activity',
        subtitle: 'The other side of the integration — what the mock CRM received.',
      }
    : sessionId === null
      ? {
          title: 'Start a dialer session',
          subtitle: 'Two lines dial at once. The first lead to answer takes the agent.',
        }
      : {
          title: 'Dialer session',
          subtitle: 'Polling every 1.5s. Wrap up the live call to resume dialing.',
        };

  return (
    <>
      <Shell view={view} onNavigate={setView} title={heading.title} subtitle={heading.subtitle}>
        {!onDialer ? (
          <Screen state={contacts} empty="The mock CRM is empty.">
            {(data) => <CrmView contacts={data} activities={activities.data ?? []} />}
          </Screen>
        ) : sessionId === null ? (
          <Screen state={leads} empty="No leads available.">
            {(data) => <LeadPicker leads={data} onStart={start} busy={busy} />}
          </Screen>
        ) : (
          <Screen state={session} empty="Session not found.">
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
      </Shell>

      <Snackbar toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

/**
 * Renders the loading and empty states around polled data.
 *
 * Errors deliberately do not render here — they go to the snackbar, so stale
 * data stays on screen while a retry is in flight rather than being replaced
 * by a message.
 *
 * @param props the poll state, an empty message, and the success renderer
 * @returns whichever state currently applies
 */
function Screen<T>({
  state,
  empty,
  children,
}: {
  state: { data: T | null; error: unknown; loading: boolean; refresh: () => void };
  empty: string;
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

  if (state.data === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">
          {state.error === null ? empty : 'Could not load this. The snackbar has details.'}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={state.refresh}>
          Retry
        </Button>
      </div>
    );
  }

  return <>{children(state.data)}</>;
}
