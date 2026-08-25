import type { Disposition } from '@salesdoc/shared';
import { useCallback, useState } from 'react';
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
      toasts.push('info', 'Session stopped', 'Active calls were cancelled.');
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
