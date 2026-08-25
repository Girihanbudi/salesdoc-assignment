import type { Lead } from '@salesdoc/shared';
import { render, screen, waitFor } from '@testing-library/react';
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
    window.localStorage.setItem('salesdoc:last-session', 'session-abc');
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
