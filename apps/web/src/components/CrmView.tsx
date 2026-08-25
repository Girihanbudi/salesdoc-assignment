import type { CRMActivity, CRMContact } from '@salesdoc/shared';
import { Card, CardLabel } from '@/components/ui/card.js';

/** Props for {@link CrmView}. */
export interface CrmViewProps {
  contacts: CRMContact[];
  activities: CRMActivity[];
}

/**
 * What the mock CRM holds — the other side of the integration.
 *
 * Exists so the write-behind is inspectable without curl: an interviewer can
 * run a session and watch contacts and activities appear here.
 *
 * @param props the CRM's contacts and activities
 * @returns the CRM screen
 */
export function CrmView({ contacts, activities }: CrmViewProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-7 py-5">
          <CardLabel>Contacts</CardLabel>
          <p className="mt-1 text-sm text-muted">
            Created on the first terminal call for a lead that had no
            <code className="mx-1 rounded bg-bg px-1 py-0.5 text-xs">crmExternalId</code>.
          </p>
        </div>

        {contacts.length === 0 ? (
          <p className="px-7 py-12 text-center text-sm text-muted">
            No contacts yet. Run a session and they appear here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-4 px-7 py-4">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{contact.name}</span>
                  <span className="block truncate text-sm text-muted">{contact.company}</span>
                </span>
                <code className="tnum shrink-0 text-xs text-muted">{contact.id}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-7 py-5">
          <CardLabel>Activities</CardLabel>
          <p className="mt-1 text-sm text-muted">
            Exactly one per terminal call — the <code className="mx-1 rounded bg-bg px-1 py-0.5 text-xs">callId</code>
            is the idempotency key.
          </p>
        </div>

        {activities.length === 0 ? (
          <p className="px-7 py-12 text-center text-sm text-muted">No activities yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {activities.map((activity) => (
              <li key={activity.id} className="px-7 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">{activity.disposition}</span>
                  <span className="tnum shrink-0 text-xs text-muted">
                    {new Date(activity.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{activity.notes}</p>
                <code className="mt-1 block text-xs text-muted/70">{activity.callId}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
