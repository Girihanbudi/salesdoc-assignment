import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button.js';
import { useToast } from '@/hooks/useToasts.js';
import { toUserMessage } from '@/constant/error-messages.js';

/** What a polled or fetched resource currently knows. */
export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  refresh: () => void;
}

/** Props for {@link AsyncView}. */
export interface AsyncViewProps<T> {
  state: AsyncState<T>;
  /** Shown when the request succeeded but there is nothing to display. */
  empty: string;
  children: (data: T) => ReactNode;
}

/**
 * Renders the loading and empty states around fetched data.
 *
 * Errors deliberately do not render here — they go to the snackbar, so stale
 * data stays on screen while a retry is in flight rather than being replaced
 * by a message.
 *
 * @param props the state, an empty message, and the success renderer
 * @returns whichever state currently applies
 */
export function AsyncView<T>({ state, empty, children }: AsyncViewProps<T>) {
  const { push } = useToast();

  // Reported here rather than per screen: every fetch in the app goes through
  // an AsyncView, so this is the one place that cannot be forgotten. useToasts
  // drops a duplicate already on screen, so a failing poll reports once rather
  // than on every tick.
  useEffect(() => {
    if (state.error === null || state.error === undefined) return;
    const { title, detail } = toUserMessage(state.error);
    push('error', title, detail);
  }, [state.error, push]);

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
