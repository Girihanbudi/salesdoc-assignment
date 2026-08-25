import { useCallback, useEffect, useState } from 'react';

/** One entry in the URL's query string. */
export type UrlState = Record<string, string | null>;

/**
 * Reads the current query string.
 *
 * @returns the params as a plain object
 */
function readParams(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

/**
 * Keeps a slice of app state in the URL's query string.
 *
 * The URL is the source of truth for *where you are*, so a refresh, a
 * bookmark, or a shared link all land on the same screen. Without this, a
 * reload during a live session dumps the agent back to the lead picker with a
 * session still running behind them.
 *
 * `history.pushState` rather than a router: two screens do not justify the
 * dependency, and back/forward still work because `popstate` is handled.
 *
 * @returns the current params and a setter; null removes a key
 */
export function useUrlState(): [Record<string, string>, (next: UrlState) => void] {
  const [params, setParams] = useState<Record<string, string>>(readParams);

  useEffect(() => {
    const onPop = (): void => {
      setParams(readParams());
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const update = useCallback((next: UrlState) => {
    const search = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }

    const query = search.toString();
    window.history.pushState({}, '', query ? `?${query}` : window.location.pathname);
    setParams(readParams());
  }, []);

  return [params, update];
}
