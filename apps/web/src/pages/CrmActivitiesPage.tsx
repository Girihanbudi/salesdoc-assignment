import type { CRMActivity } from '@salesdoc/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card.js';
import { dateTime } from '@/lib/format.js';
import { PATHS } from '@/routes/paths.js';

/** Props for {@link CrmActivitiesPage}. */
export interface CrmActivitiesPageProps {
  activities: CRMActivity[];
}

/**
 * Everything we have written to the CRM, newest first.
 *
 * @param props the activities to list
 * @returns the activity list
 */
export function CrmActivitiesPage({ activities }: CrmActivitiesPageProps) {
  if (activities.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted">Nothing written yet.</p>
        <Link to={PATHS.dial} className="mt-2 inline-block text-sm font-medium underline">
          Run a session
        </Link>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {activities.map((activity) => (
          <li key={activity.id}>
            <Link
              to={PATHS.crmActivity(activity.callId)}
              className="flex items-center justify-between gap-4 px-7 py-4 transition-colors hover:bg-bg"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{activity.disposition}</span>
                <span className="block truncate text-sm text-muted">
                  {activity.notes || 'No notes'}
                </span>
                <code className="mt-1 block truncate text-xs text-muted/70">
                  {activity.callId}
                </code>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tnum text-xs text-muted">{dateTime(activity.createdAt)}</span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
