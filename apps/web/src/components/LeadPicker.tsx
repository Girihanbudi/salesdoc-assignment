import type { Lead } from '@salesdoc/shared';
import { ArrowRight, Phone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Card } from '@/components/ui/card.js';
import { cn } from '@/lib/utils.js';

/** Props for {@link LeadPicker}. */
export interface LeadPickerProps {
  leads: Lead[];
  /** Called with the selected lead ids, in table order. */
  onStart: (leadIds: string[]) => void;
  busy: boolean;
  /** A session the server says is still running, if there is one. */
  resumableSessionId: string | null;
  onResume: () => void;
}

/**
 * Screen 1 — pick leads and open a dialer session.
 *
 * @param props the leads to show and the start handler
 * @returns the lead table
 */
export function LeadPicker({
  leads,
  onStart,
  busy,
  resumableSessionId,
  onResume,
}: LeadPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = leads.length > 0 && selected.size === leads.length;

  return (
    <div className="flex flex-col gap-5">
      {resumableSessionId !== null && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border border-accent/40 p-4 sm:p-5">
          <div>
            <p className="font-medium">You have a session in progress</p>
            <p className="text-sm text-muted">
              Calls keep running while you are away.{' '}
              <code className="rounded bg-bg px-1 py-0.5 text-xs">{resumableSessionId}</code>
            </p>
          </div>
          {/* No dismiss: the session really is running on the server, and
              hiding the way back to it would not make that less true. It
              disappears when the session ends. */}
          <Button onClick={onResume}>
            Go to active session
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-5 sm:px-7">
        <div>
          <h2 className="text-lg font-semibold">Leads</h2>
          <p className="text-sm text-muted">
            Pick the leads to work. Two are dialed at a time.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))
          }
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </Button>
      </div>

      {leads.length === 0 ? (
        <p className="px-4 py-12 text-center text-muted sm:px-7">No leads available.</p>
      ) : (
        <table className="w-full">
          <caption className="sr-only">Available leads</caption>
          <thead>
            <tr className="text-left text-xs font-medium tracking-wide text-muted uppercase">
              <th scope="col" className="w-12 py-3 pl-4 sm:w-16 sm:pl-7" />
              <th scope="col" className="py-3">Name</th>
              <th scope="col" className="hidden py-3 sm:table-cell">Phone</th>
              <th scope="col" className="py-3 pr-4 text-right sm:pr-7">CRM</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const checked = selected.has(lead.id);
              return (
                <tr
                  key={lead.id}
                  className={cn(
                    'border-t border-line transition-colors',
                    checked && 'bg-accent/10'
                  )}
                >
                  <td className="py-4 pr-3 pl-4 sm:pr-4 sm:pl-7">
                    <input
                      type="checkbox"
                      id={`lead-${lead.id}`}
                      checked={checked}
                      onChange={() => toggle(lead.id)}
                      className="size-4 cursor-pointer accent-ink"
                    />
                  </td>
                  <td className="py-4">
                    <label htmlFor={`lead-${lead.id}`} className="block cursor-pointer">
                      <span className="block font-medium">{lead.name}</span>
                      <span className="block text-sm text-muted">{lead.company}</span>
                      {/* The phone column is dropped on a phone, so it moves
                          under the name rather than disappearing. */}
                      <span className="tnum block text-sm text-muted sm:hidden">
                        {lead.phone}
                      </span>
                    </label>
                  </td>
                  <td className="tnum hidden py-4 text-sm text-muted sm:table-cell">{lead.phone}</td>
                  <td className="py-4 pr-4 text-right sm:pr-7">
                    {lead.crmExternalId ? (
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-muted">
                        Linked
                      </span>
                    ) : (
                      <span className="text-xs text-muted">New contact</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-5 sm:px-7">
        <p className="text-sm text-muted" role="status">
          {selected.size} selected
        </p>
        <Button
          onClick={() => onStart(leads.filter((l) => selected.has(l.id)).map((l) => l.id))}
          disabled={selected.size === 0 || busy}
        >
          <Phone className="size-4" aria-hidden />
          {busy ? 'Starting…' : 'Create session & start'}
        </Button>
      </div>
      </Card>
    </div>
  );
}
