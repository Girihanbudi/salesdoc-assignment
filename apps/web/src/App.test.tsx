import type { Lead } from '@salesdoc/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

const LEADS: Lead[] = [
  {
    id: 'lead-1',
    name: 'Amara Osei',
    company: 'Northwind Logistics',
    phone: '+1 415 555 0142',
    email: 'amara@northwind.com',
  },
  {
    id: 'lead-2',
    name: 'Rafael Moreno',
    company: 'Cobalt Health',
    phone: '+1 415 555 0177',
    email: 'r.moreno@cobalthealth.io',
    crmExternalId: 'crm-contact-88213',
  },
];

/**
 * Wraps a payload the way the API does, so the client's unwrapping is exercised
 * rather than bypassed.
 *
 * @param data the payload to envelope
 * @returns a fetch Response carrying the success envelope
 */
function enveloped(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: { requestId: 'req-test', timestamp: new Date().toISOString() },
    })
  );
}

/** Minimal session payload — enough for the dashboard to render. */
const SESSION_VIEW = {
  session: {
    id: 'session-abc',
    agentId: 'agent-1',
    leadQueue: [],
    concurrency: 2,
    activeCallIds: [],
    winnerCallId: null,
    status: 'STOPPED',
    metrics: { attempted: 0, connected: 0, failed: 0, canceled: 0 },
  },
  lines: [],
  winner: null,
  history: [],
  upNext: [],
  activities: [],
};

/**
 * Routes every endpoint the app polls to a sensible default.
 *
 * The app now fetches several lists per screen, so a single-response stub
 * would make tests pass or fail for reasons unrelated to what they assert.
 *
 * @param overrides path fragment to payload, for the endpoint under test
 * @returns a fetch stub
 */
function stubApi(overrides: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    for (const [fragment, payload] of Object.entries(overrides)) {
      if (url.includes(fragment)) return Promise.resolve(enveloped(payload));
    }
    if (url.includes('/api/leads')) return Promise.resolve(enveloped(LEADS));
    if (url.includes('/api/sessions/')) return Promise.resolve(enveloped(SESSION_VIEW));
    return Promise.resolve(enveloped([]));
  });
}

/**
 * Renders the app at a given path.
 *
 * @param path where to start
 */
function renderAt(path: string): void {
  window.history.pushState({}, '', path);
  render(<App />);
}

beforeEach(() => {
  vi.stubGlobal('fetch', stubApi());
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

describe('routing', () => {
  it('redirects the root to the dashboard', async () => {
    renderAt('/');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('shows a 404 for an unknown path instead of a blank screen', async () => {
    renderAt('/sdf');

    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
  });

  it('keeps the bad URL rather than silently bouncing away from it', async () => {
    // Redirecting instantly would hide that the link was wrong, which matters
    // when it came from a bookmark or a teammate.
    renderAt('/sdf');

    await screen.findByText('404');
    expect(window.location.pathname).toBe('/sdf');
  });
});

describe('lead selection', () => {
  it('lists the leads it fetched', async () => {
    renderAt('/dial');

    expect(await screen.findByText('Amara Osei')).toBeInTheDocument();
    expect(screen.getByText('Cobalt Health')).toBeInTheDocument();
  });

  it('enables the start button only once a lead is selected', async () => {
    const user = userEvent.setup();
    renderAt('/dial');

    const start = await screen.findByRole('button', { name: /create session & start/i });
    expect(start).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Amara Osei/i }));

    await waitFor(() => {
      expect(start).toBeEnabled();
    });
  });
});

describe('error handling', () => {
  it('explains an unreachable server instead of showing "Failed to fetch"', async () => {
    // fetch rejects with a bare TypeError when nothing is listening. Surfacing
    // that verbatim tells the user nothing they can act on.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderAt('/dial');

    expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument();
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
  });

  it('translates a server error code rather than echoing the server wording', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              error: { code: 'INTERNAL', message: 'connection pool exhausted' },
              meta: { requestId: 'req-1', timestamp: new Date().toISOString() },
            }),
            { status: 500 }
          )
        )
      )
    );
    renderAt('/dial');

    expect(await screen.findByText(/something went wrong on our end/i)).toBeInTheDocument();
    // Internal detail must never reach the user.
    expect(screen.queryByText(/connection pool/i)).not.toBeInTheDocument();
  });

  it('lets a toast be dismissed', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderAt('/dial');

    const toast = await screen.findByText('Cannot reach the server');
    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    await waitFor(() => {
      expect(toast).not.toBeInTheDocument();
    });
  });
});

describe('session in the URL', () => {
  it('goes straight to the session named in the query string', async () => {
    // A refresh mid-session must not dump the agent back to the lead picker
    // while calls are still running behind them.
    renderAt('/dial?session=session-abc');

    expect(await screen.findByText(/line 1/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('offers a way back into a session left running', async () => {
    window.localStorage.setItem('salesdoc:active-session', 'session-abc');
    renderAt('/dial');

    expect(await screen.findByText(/session in progress/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to active session/i })).toBeInTheDocument();
  });

  it('does not offer resume when there is no earlier session', async () => {
    renderAt('/dial');

    await screen.findByText('Amara Osei');
    expect(screen.queryByText(/session in progress/i)).not.toBeInTheDocument();
  });
});

describe('polling lifecycle', () => {
  /**
   * A session view with a chosen status.
   *
   * @param status whether the session is still dialing
   * @returns the payload
   */
  function sessionWith(status: 'RUNNING' | 'STOPPED') {
    return { ...SESSION_VIEW, session: { ...SESSION_VIEW.session, status } };
  }

  it('stops polling once the session finishes', async () => {
    // Nothing about a finished session can change again, so polling on would
    // be a request every 1.5s forever — and on a free tier that keeps the
    // server awake for no reason.
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/sessions/')) {
        return Promise.resolve(enveloped(sessionWith('STOPPED')));
      }
      return Promise.resolve(enveloped(LEADS));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAt('/dial?session=session-abc');
    await screen.findByText(/line 1/i);

    const callsAfterLoad = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 3500));

    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
  });

  it('forgets a finished session, so it is not offered for resume', async () => {
    window.localStorage.setItem('salesdoc:active-session', 'session-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/sessions/')) {
          return Promise.resolve(enveloped(sessionWith('STOPPED')));
        }
        return Promise.resolve(enveloped(LEADS));
      })
    );

    renderAt('/dial?session=session-abc');
    await screen.findByText(/line 1/i);

    await waitFor(() => {
      expect(window.localStorage.getItem('salesdoc:active-session')).toBeNull();
    });
  });

  it('keeps polling while the session is still running', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/sessions/')) {
        return Promise.resolve(enveloped(sessionWith('RUNNING')));
      }
      return Promise.resolve(enveloped(LEADS));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAt('/dial?session=session-abc');
    await screen.findByText(/line 1/i);

    const callsAfterLoad = fetchMock.mock.calls.length;
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterLoad), {
      timeout: 4000,
    });
  });
});

describe('page transitions', () => {
  it('renders the destination after navigating, not a blank frame', async () => {
    // AnimatePresence mode="wait" holds the outgoing page until its exit
    // finishes. A wrong key or a missing exit leaves nothing mounted.
    const user = userEvent.setup();
    renderAt('/dashboard');

    // Heading, not nav — "Dashboard" also names two links.
    await screen.findByRole('heading', { name: 'Dashboard' });

    const [navLink] = screen.getAllByRole('link', { name: /CRM activity/i });
    await user.click(navLink!);

    expect(await screen.findByText(/everything written to the CRM/i)).toBeInTheDocument();
  });

  it('honours prefers-reduced-motion', async () => {
    // jsdom reports no preference by default, so this has to be stubbed —
    // otherwise the reduced-motion branch is never exercised anywhere.
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      }))
    );

    renderAt('/dashboard');

    // The page must still render; reduced motion means no movement, not no UI.
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});

describe('mobile navigation', () => {
  it('hides the menu behind a burger until it is opened', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');
    await screen.findByRole('heading', { name: 'Dashboard' });

    const burger = screen.getByRole('button', { name: /open menu/i });
    expect(burger).toHaveAttribute('aria-expanded', 'false');

    await user.click(burger);

    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /menu/i })).toBeInTheDocument();
  });

  it('closes the menu after navigating, so the page is not left underneath it', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const menu = screen.getByRole('dialog', { name: /menu/i });
    await user.click(within(menu).getByRole('link', { name: /Sessions/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
    });
  });
});

describe('breadcrumbs', () => {
  it('gives a nested page a way back to its list', async () => {
    renderAt('/sessions/session-abc');

    const crumbs = await screen.findByRole('navigation', { name: /breadcrumb/i });
    expect(within(crumbs).getByRole('link', { name: 'Sessions' })).toHaveAttribute(
      'href',
      '/sessions'
    );
    // The page you are on is not a link — that would be a dead control.
    expect(within(crumbs).getByText('session-abc')).toHaveAttribute('aria-current', 'page');
  });

  it('leaves top-level pages without a trail', async () => {
    renderAt('/sessions');

    await screen.findByRole('heading', { name: 'Sessions' });
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
  });
});

describe('active section marker', () => {
  it('marks the current section in the rail', async () => {
    renderAt('/sessions');
    await screen.findByRole('heading', { name: 'Sessions' });

    const rail = screen.getByRole('navigation', { name: /sections/i });
    // The marker moved out of className into a sibling element, so the thing
    // worth guarding is that "which one is active" still reaches the DOM.
    expect(within(rail).getByRole('link', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(rail).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('moves the marker when the section changes', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');
    await screen.findByRole('heading', { name: 'Dashboard' });

    const rail = screen.getByRole('navigation', { name: /sections/i });
    await user.click(within(rail).getByRole('link', { name: 'CRM activity' }));

    await waitFor(() => {
      expect(within(rail).getByRole('link', { name: 'CRM activity' })).toHaveAttribute(
        'aria-current',
        'page'
      );
    });
    expect(within(rail).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current'
    );
  });
});

describe('session finished toast', () => {
  /**
   * A finished session whose calls did or did not reach the CRM.
   *
   * @param crmSyncStatus what the one call's CRM write ended as
   * @returns the session view payload
   */
  function finishedWith(crmSyncStatus: 'synced' | 'failed') {
    const call = {
      call: {
        id: 'call-1',
        leadId: 'lead-1',
        sessionId: 'session-abc',
        status: 'NO_ANSWER',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        providerCallId: 'mock_1',
      },
      lead: LEADS[0],
      crmSyncStatus,
    };

    return {
      ...SESSION_VIEW,
      session: {
        ...SESSION_VIEW.session,
        status: 'RUNNING',
        metrics: { attempted: 1, connected: 0, failed: 1, canceled: 0 },
      },
      history: [call],
    };
  }

  /**
   * Serves RUNNING once, then STOPPED, so the finish edge actually fires.
   *
   * @param crmSyncStatus what the call's CRM write ended as
   * @returns a fetch stub
   */
  function stubFinishing(crmSyncStatus: 'synced' | 'failed') {
    let polls = 0;
    return vi.fn((url: string) => {
      if (url.includes('/api/sessions/')) {
        const view = finishedWith(crmSyncStatus);
        polls += 1;
        return Promise.resolve(
          enveloped(
            polls === 1 ? view : { ...view, session: { ...view.session, status: 'STOPPED' } }
          )
        );
      }
      return Promise.resolve(enveloped(LEADS));
    });
  }

  it('reports success when every call reached the CRM', async () => {
    vi.stubGlobal('fetch', stubFinishing('synced'));
    renderAt('/dial?session=session-abc');

    // The edge only fires on the second poll, 1.5s in — past the default
    // query timeout.
    expect(await screen.findByText('Session finished', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/every call reached the CRM/i)).toBeInTheDocument();
    expect(screen.getByText('Success:')).toBeInTheDocument();
  });

  it('reports a warning when a write never landed', async () => {
    // A green "all done" beside a warning that writes failed would contradict
    // itself, so the finish toast carries the bad news instead.
    vi.stubGlobal('fetch', stubFinishing('failed'));
    renderAt('/dial?session=session-abc');

    const title = await screen.findByText('Session finished', {}, { timeout: 5000 });

    // Scoped to this toast: a separate warning fires the moment a write fails
    // mid-run, and it says something similar. Both are wanted — one is timely,
    // this one is the summary.
    const toast = title.closest('[class*="rounded"]')?.parentElement;
    expect(toast?.textContent).toMatch(/did not reach the CRM/i);
    expect(screen.queryByText('Success:')).not.toBeInTheDocument();
  });
});
