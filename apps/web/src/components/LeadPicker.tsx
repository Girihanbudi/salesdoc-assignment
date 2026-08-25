import type { Lead } from '@salesdoc/shared';
import { Phone } from 'lucide-react';
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
}

/**
 * Screen 1 — pick leads and open a dialer session.
 *
 * @param props the leads to show and the start handler
 * @returns the lead table
 */
export function LeadPicker({ leads, onStart, busy }: LeadPickerProps) {
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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-7 py-5">
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
        <p className="px-7 py-12 text-center text-muted">No leads available.</p>
      ) : (
        <table className="w-full">
          <caption className="sr-only">Available leads</caption>
          <thead>
            <tr className="text-left text-xs font-medium tracking-wide text-muted uppercase">
              <th scope="col" className="w-12 py-3 pl-7" />
              <th scope="col" className="py-3">Name</th>
              <th scope="col" className="py-3">Phone</th>
              <th scope="col" className="py-3 pr-7 text-right">CRM</th>
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
                  <td className="py-4 pl-7">
                    <input
                      type="checkbox"
                      id={`lead-${lead.id}`}
                      checked={checked}
                      onChange={() => toggle(lead.id)}
                      className="size-4 accent-ink"
                    />
                  </td>
                  <td className="py-4">
                    <label htmlFor={`lead-${lead.id}`} className="cursor-pointer">
                      <span className="block font-medium">{lead.name}</span>
                      <span className="block text-sm text-muted">{lead.company}</span>
                    </label>
                  </td>
                  <td className="tnum py-4 text-sm text-muted">{lead.phone}</td>
                  <td className="py-4 pr-7 text-right">
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

      <div className="flex items-center justify-between border-t border-line px-7 py-5">
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
  );
}
