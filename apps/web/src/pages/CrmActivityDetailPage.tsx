import type { ActivityDetail } from '@salesdoc/shared';
import { StatusBadge } from '@/components/ui/badge.js';
import { Card, CardLabel } from '@/components/ui/card.js';
import { dateTime, durationSeconds } from '@/lib/format.js';

/** Props for {@link CrmActivityDetailPage}. */
export interface CrmActivityDetailPageProps {
  detail: ActivityDetail;
}

/**
 * One CRM activity, with the lead and the call that produced it.
 *
 * @param props the hydrated activity
 * @returns the detail page
 */
export function CrmActivityDetailPage({ detail }: CrmActivityDetailPageProps) {
  const { activity, lead, call } = detail;

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 sm:p-7">
        <CardLabel>Activity</CardLabel>
        <p className="mt-1 text-2xl font-bold tracking-tight">{activity.disposition}</p>
        <p className="mt-4 whitespace-pre-wrap text-muted">
          {activity.notes || 'No notes were recorded.'}
        </p>

        <dl className="mt-7 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-2">
          <Field label="Written at" value={dateTime(activity.createdAt)} />
          <Field label="Type" value={activity.type} />
          <Field label="Call id" value={activity.callId} mono />
          <Field label="CRM contact" value={activity.crmExternalId} mono />
        </dl>
      </Card>

      <div className="flex flex-col gap-4 sm:gap-5">
        <Card className="p-6">
          <CardLabel>Lead</CardLabel>
          <p className="mt-2 font-semibold">{lead.name}</p>
          <p className="text-sm text-muted">{lead.company}</p>
          <p className="tnum mt-3 text-sm text-muted">{lead.phone}</p>
          <p className="mt-1 truncate text-sm text-muted">{lead.email}</p>
        </Card>

        <Card className="p-6">
          <CardLabel>Call</CardLabel>
          {call === null ? (
            <p className="mt-3 text-sm text-muted">
              The call record is gone — in-memory state is cleared on restart.
            </p>
          ) : (
            <>
              <div className="mt-3">
                <StatusBadge status={call.status} />
              </div>
              <dl className="mt-4 flex flex-col gap-3">
                <Field label="Duration" value={`${String(durationSeconds(call.startedAt, call.endedAt))}s`} />
                <Field label="Started" value={dateTime(call.startedAt)} />
                <Field label="Provider id" value={call.providerCallId} mono />
              </dl>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * One label/value pair.
 *
 * @param props the label, the value, and whether to render it monospaced
 * @returns the pair
 */
function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={mono ? 'mt-0.5 truncate font-mono text-sm' : 'mt-0.5 text-sm'}>{value}</dd>
    </div>
  );
}
