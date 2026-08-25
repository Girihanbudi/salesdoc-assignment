import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '@/api.js';
import { AsyncView } from '@/components/AsyncView.js';
import { Dashboard } from '@/components/Dashboard.js';
import { LeadPicker } from '@/components/LeadPicker.js';
import { usePoll } from '@/hooks/usePoll.js';
import { useToast } from '@/hooks/useToasts.js';
import { toUserMessage } from '@/lib/fetcher.js';

/** How often the live dashboard refreshes. The brief asks for 1-2s. */
const POLL_MS = 1500;

/** Props for {@link DialPage}. */
export interface DialPageProps {
  /** A session this browser started that has not finished, if any. */
  activeSessionId: string | null;
  onSessionStarted: (sessionId: string) => void;
  onSessionFinished: () => void;
}

/**
 * Lead picker, or the live dashboard when `?session=` names one.
 *
 * The session id lives in the query string rather than component state, so a
 * refresh mid-call returns to the same session instead of stranding it.
 *
 * @param props resume plumbing
 * @returns whichever half of the dialer applies
 */
export function DialPage({
  activeSessionId,
  onSessionStarted,
  onSessionFinished,
}: DialPageProps) {
  const toasts = useToast();
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const [busy, setBusy] = useState(false);

  const leads = usePoll(api.getLeads, 10_000, sessionId === null);

  // Polling stops the moment the session reports STOPPED. Nothing about a
  // finished session can change again, so continuing would be a request every
  // 1.5s forever — and on a free tier that is the difference between an idle
  // tab and one that never lets the server sleep.
  //
  // `finished` starts false so a session opened cold still gets its first
  // fetch; the data it returns is what turns polling off.
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setFinished(false);
  }, [sessionId]);

  const session = usePoll(
    useCallback(() => api.getSessionView(sessionId ?? ''), [sessionId]),
    POLL_MS,
    sessionId !== null && !finished
  );

  // The dialer stops on its own once the queue drains, and nothing on screen
  // announces it — the agent is usually looking elsewhere by then. Fire once on
  // the RUNNING -> STOPPED edge rather than on every poll that sees STOPPED.
  const wasRunning = useRef(false);
  const view = session.data;

  useEffect(() => {
    if (!view) return;
    const running = view.session.status === 'RUNNING';

    if (!running) {
      setFinished(true);
      // The session is over, so this browser no longer has one in progress.
      // Leaving it behind would offer "resume" on something already finished.
      onSessionFinished();
    }

    if (wasRunning.current && !running) {
      const { attempted, connected } = view.session.metrics;

      // Green only when nothing went wrong. A separate warning already says
      // some writes never landed, and a green "all done" beside it would
      // contradict itself — so a session with failures reports as one.
      const failedWrites = view.history.filter((l) => l.crmSyncStatus === 'failed').length;

      toasts.push(
        failedWrites > 0 ? 'warning' : 'success',
        'Session finished',
        failedWrites > 0
          ? `${String(attempted)} attempted · ${String(failedWrites)} did not reach the CRM.`
          : `${String(attempted)} attempted · ${String(connected)} connected. Every call reached the CRM.`
      );
    }
    wasRunning.current = running;
  }, [view, toasts, onSessionFinished]);

  // A failed CRM write is the only silent failure in the flow: the call still
  // shows its outcome, and nothing else says the record never landed.
  const failedSyncCount = view?.history.filter((l) => l.crmSyncStatus === 'failed').length ?? 0;

  useEffect(() => {
    if (failedSyncCount === 0) return;
    toasts.push(
      'warning',
      `${String(failedSyncCount)} call${failedSyncCount === 1 ? '' : 's'} did not reach the CRM`,
      'The call outcome is recorded, but no activity was written.'
    );
  }, [failedSyncCount, toasts]);

  const report = (cause: unknown, fallback: string): void => {
    const { title, detail } = toUserMessage(cause, fallback);
    toasts.push('error', title, detail);
  };

  const start = async (leadIds: string[]): Promise<void> => {
    setBusy(true);
    try {
      const created = await api.createSession(leadIds);
      await api.startSession(created.id);
      onSessionStarted(created.id);
      setParams({ session: created.id });
      toasts.push('success', `Dialing ${String(leadIds.length)} leads`, 'Two lines at a time.');
    } catch (cause) {
      report(cause, 'Could not start the session');
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
      toasts.push('warning', 'Session stopped', 'Any calls still ringing were cancelled.');
    } catch (cause) {
      report(cause, 'Could not stop the session');
    } finally {
      setBusy(false);
    }
  };

  if (sessionId === null) {
    return (
      <AsyncView state={leads} empty="No leads available.">
        {(data) => (
          <LeadPicker
            leads={data}
            onStart={start}
            busy={busy}
            resumableSessionId={activeSessionId}
            onResume={() => {
              if (activeSessionId !== null) setParams({ session: activeSessionId });
            }}
            onDiscardResumable={onSessionFinished}
          />
        )}
      </AsyncView>
    );
  }

  return (
    <AsyncView state={session} empty="Session not found.">
      {(data) => (
        <Dashboard
          view={data}
          onStop={stop}
          onReset={() => {
            onSessionFinished();
            setParams({});
          }}
          busy={busy}
        />
      )}
    </AsyncView>
  );
}
