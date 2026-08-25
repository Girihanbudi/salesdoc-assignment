import type { SessionDetail } from '@salesdoc/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CallDurations } from '@/components/CallDurations.js';
import { StatusBadge } from '@/components/ui/badge.js';
import { Card, CardLabel } from '@/components/ui/card.js';
import { durationSeconds, time } from '@/lib/format.js';
import { PATHS } from '@/routes/paths.js';

/** Props for {@link SessionDetailPage}. */
export interface SessionDetailPageProps {
  detail: SessionDetail;
}

/**
 * Every call a session placed, and what each one wrote to the CRM.
 *
 * A call with no activity is shown plainly rather than hidden — a missing
 * write is exactly the thing worth noticing.
 *
 * @param props the session and its calls
 * @returns the session log
 */
export function SessionDetailPage({ detail }: SessionDetailPageProps) {
  const { session, calls, activities } = detail;
  const activityByCallId = new Map(activities.map((a) => [a.callId, a]));

  const tiles = [
    { label: 'Attempted', value: session.metrics.attempted },
    { label: 'Connected', value: session.metrics.connected },
    { label: 'Failed', value: session.metrics.failed },
    { label: 'Canceled', value: session.metrics.canceled },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>Session {session.id}</CardLabel>
          <span className="text-sm text-muted">Agent {session.agentId}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-[var(--radius-tile)] bg-bg p-4">
              <p className="tnum text-2xl font-semibold">{tile.value}</p>
              <p className="mt-0.5 text-xs text-muted">{tile.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <CallDurations calls={calls} winnerCallId={session.winnerCallId} />

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <CardLabel>Calls</CardLabel>
          <p className="mt-1 text-sm text-muted">
            Newest first. Open one to see what was written to the CRM.
          </p>
        </div>

        {calls.length === 0 ? (
          <p className="px-5 py-12 sm:px-7 text-center text-sm text-muted">
            No calls placed in this session.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {calls.map(({ call, lead }) => {
              const activity = activityByCallId.get(call.id);
              const row = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{lead.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {lead.company} · {durationSeconds(call.startedAt, call.endedAt)}s ·{' '}
                      {time(call.startedAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={call.status} />
                    {activity ? (
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    ) : (
                      <span className="text-xs text-muted">no CRM record</span>
                    )}
                  </span>
                </>
              );

              return (
                <li key={call.id}>
                  {activity ? (
                    <Link
                      to={PATHS.crmActivity(call.id)}
                      className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7 transition-colors hover:bg-bg"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
