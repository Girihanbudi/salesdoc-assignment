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

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(LEADS))))
  );
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

describe('error state', () => {
  it('offers a retry rather than an empty screen when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network down'))));
    render(<App />);

    expect(await screen.findByText('Network down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
