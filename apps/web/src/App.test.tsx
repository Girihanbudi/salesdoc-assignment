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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(enveloped(LEADS))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lead selection', () => {
  it('lists the leads it fetched', async () => {
    render(<App />);
    expect(await screen.findByText('Amara Osei')).toBeInTheDocument();
    expect(screen.getByText('Cobalt Health')).toBeInTheDocument();
  });

  it('enables the start button only once a lead is selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    const start = await screen.findByRole('button', { name: /create session & start/i });
    expect(start).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Amara Osei/i }));

    await waitFor(() => expect(start).toBeEnabled());
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});

describe('error handling', () => {
  it('explains an unreachable server instead of showing "Failed to fetch"', async () => {
    // fetch rejects with a bare TypeError when nothing is listening. Surfacing
    // that verbatim tells the user nothing they can act on.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<App />);

    expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument();
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
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
    render(<App />);

    expect(await screen.findByText(/something went wrong on our end/i)).toBeInTheDocument();
    // Internal detail must never reach the user.
    expect(screen.queryByText(/connection pool/i)).not.toBeInTheDocument();
  });

  it('lets a toast be dismissed', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<App />);

    const toast = await screen.findByText('Cannot reach the server');
    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    await waitFor(() => expect(toast).not.toBeInTheDocument());
  });
});
