import type { LineView } from '@salesdoc/shared';
import { CALL_STATUS_STYLES } from '@/components/ui/badge.js';
import { Card, CardLabel } from '@/components/ui/card.js';
import { durationSeconds } from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/** Props for {@link CallDurations}. */
export interface CallDurationsProps {
  /** Every call in the session, newest first. */
  calls: LineView[];
  /** The call currently holding the agent, if any. Null on a finished session. */
  winnerCallId?: string | null;
}

/**
 * One bar per attempt, scaled by how long the call lasted.
 *
 * Duration is the only real quantity a mocked call produces, so it is what the
 * chart shows. Height alone would be ambiguous, so colour encodes the outcome,
 * a legend spells the colours out, and every bar carries a text tooltip.
 *
 * Shared by the live dashboard and the after-the-fact session log: the same
 * question ("how did this session go?") deserves the same answer in both
 * places.
 *
 * @param props the calls and the current winner
 * @returns the chart card
 */
export function CallDurations({ calls, winnerCallId = null }: CallDurationsProps) {
  // Calls arrive newest-first; a timeline reads oldest-first.
  const bars = [...calls].reverse().map((line) => ({
    line,
    seconds: durationSeconds(line.call.startedAt, line.call.endedAt),
  }));

  const longest = Math.max(...bars.map((b) => b.seconds), 1);

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardLabel>Call durations</CardLabel>
          <p className="mt-1 text-sm text-muted">
            How long each attempt lasted, oldest first.
          </p>
        </div>
        <Legend />
      </div>

      {bars.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No calls placed yet.</p>
      ) : (
        <ul className="mt-6 flex h-32 items-end gap-2">
          {bars.map(({ line, seconds }) => (
            <li key={line.call.id} className="flex h-full flex-1 flex-col justify-end gap-2">
              <span
                className={cn(
                  'w-full rounded-t-lg transition-[height] duration-500',
                  barTone(line.call.status, line.call.id === winnerCallId)
                )}
                // A floor of 8% keeps a very short call visible rather than
                // rendering as nothing at all.
                style={{ height: `${String(Math.max(8, (seconds / longest) * 100))}%` }}
                title={`${line.lead.name} — ${CALL_STATUS_STYLES[line.call.status].label} — ${String(seconds)}s`}
              />
              <span className="tnum text-center text-[10px] text-muted">{seconds}s</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Bar colour for an outcome.
 *
 * @param status the call's status
 * @param isWinner whether this call currently holds the agent
 * @returns the tailwind classes for the bar
 */
function barTone(status: LineView['call']['status'], isWinner: boolean): string {
  if (status === 'CONNECTED' || isWinner) return 'bg-accent';
  if (status === 'CANCELED_BY_DIALER') return 'bg-ink/25';
  if (status === 'DIALING') return 'bg-ink/10 animate-pulse';
  return 'bg-ink/10';
}

/** Colour is never the only signal — the legend spells each one out. */
function Legend() {
  const items = [
    { tone: 'bg-accent', label: 'Connected' },
    { tone: 'bg-ink/25', label: 'Canceled' },
    { tone: 'bg-ink/10', label: 'No answer / busy / voicemail' },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span className={cn('size-2 rounded-sm', item.tone)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
