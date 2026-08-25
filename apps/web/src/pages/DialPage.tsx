import type { Disposition } from '@salesdoc/shared';
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
  /** A session left running, offered for resume. */
  resumableSessionId: string | null;
  onSessionStarted: (sessionId: string) => void;
  onSessionForgotten: () => void;
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
  resumableSessionId,
  onSessionStarted,
  onSessionForgotten,
}: DialPageProps) {
  const toasts = useToast();
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const [busy, setBusy] = useState(false);

  const leads = usePoll(api.getLeads, 10_000, sessionId === null);
  const session = usePoll(
    useCallback(() => api.getSessionView(sessionId ?? ''), [sessionId]),
    POLL_MS,
    sessionId !== null
  );

  // The dialer stops on its own once the queue drains, and nothing on screen
  // announces it — the agent is usually looking elsewhere by then. Fire once on
  // the RUNNING -> STOPPED edge rather than on every poll that sees STOPPED.
  const wasRunning = useRef(false);
  const view = session.data;

  useEffect(() => {
    if (!view) return;
    const running = view.session.status === 'RUNNING';

    if (wasRunning.current && !running) {
      const { attempted, connected } = view.session.metrics;
      toasts.push(
        'info',
        'Session finished',
        `${String(attempted)} attempted · ${String(connected)} connected. The queue is empty.`
      );
    }
    wasRunning.current = running;
  }, [view, toasts]);

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

  const endCall = async (
    callId: string,
    outcome: { disposition: Disposition; notes: string }
  ): Promise<void> => {
    if (sessionId === null) return;
    setBusy(true);
    try {
      await api.endCall(sessionId, callId, outcome);
      session.refresh();
      toasts.push('success', 'Call wrapped up', 'Written to the CRM.');
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
            resumableSessionId={resumableSessionId}
            onResume={() => {
              if (resumableSessionId !== null) setParams({ session: resumableSessionId });
            }}
            onDiscardResumable={onSessionForgotten}
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
          onEndCall={endCall}
          onStop={stop}
          onReset={() => {
            onSessionForgotten();
            setParams({});
          }}
          busy={busy}
        />
      )}
    </AsyncView>
  );
}
