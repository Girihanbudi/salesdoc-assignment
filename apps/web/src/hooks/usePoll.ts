import { useEffect, useRef, useState } from 'react';

/** What a poll currently knows. */
export interface PollState<T> {
  data: T | null;
  /**
   * The thrown value, not a string. Flattening it to `.message` here would
   * discard the ApiError code the error handler needs to pick its wording.
   */
  error: unknown;
  /** True until the first response arrives, successful or not. */
  loading: boolean;
  /** Forces an immediate refetch, e.g. after a mutation. */
  refresh: () => void;
}

/**
 * Repeatedly calls an async function on an interval.
 *
 * Polling pauses while the tab is hidden — a backgrounded dashboard hammering
 * a free-tier server wakes nothing useful — and resumes with an immediate
 * fetch so the view is never stale on return.
 *
 * @param fetcher the request to repeat; must be stable across renders
 * @param intervalMs delay between polls; 0 or less fetches once and stops
 * @param enabled set false to stop polling entirely
 * @returns the latest data, error, and loading state
 */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true
): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Held in a ref so changing the fetcher identity doesn't restart the timer.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async (): Promise<void> => {
      if (document.hidden) return;
      try {
        const next = await fetcherRef.current();
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    // A one-shot fetch still wants the visibility handling below, so it shares
    // this effect rather than getting a second hook.
    const timer = intervalMs > 0 ? setInterval(() => void run(), intervalMs) : null;

    const onVisible = (): void => {
      if (!document.hidden) void run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled, nonce]);

  return { data, error, loading, refresh: () => setNonce((n) => n + 1) };
}
