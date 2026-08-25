import type { Disposition, LineView, SessionView } from '@salesdoc/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PhoneOff, PhoneCall, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CALL_STATUS_STYLES, CrmSyncBadge, StatusBadge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardLabel } from '@/components/ui/card.js';
import { cn } from '@/lib/utils.js';

/** Dispositions the agent can pick when wrapping up a live call. */
const DISPOSITION_LABELS: Record<Disposition, string> = {
  CONNECTED: 'Connected',
  INTERESTED: 'Interested',
  CALLBACK: 'Call back',
  NOT_INTERESTED: 'Not interested',
  NO_ANSWER: 'No answer',
  BUSY: 'Busy',
  VOICEMAIL: 'Voicemail',
  CANCELED: 'Canceled',
};

/** Props for {@link Dashboard}. */
export interface DashboardProps {
  view: SessionView;
  onStop: () => void;
  onReset: () => void;
  busy: boolean;
}

/**
 * Screen 2 — the live dialer session.
 *
 * @param props the polled session view and the agent's actions
 * @returns the dashboard
 */
export function Dashboard({ view, onStop, onReset }: DashboardProps) {
  const { session, lines, winner, history, upNext, activities } = view;
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_352px]">
      <div className="flex flex-col gap-5">
        <SessionCard view={view} />

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {[0, 1].map((index) => (
            <LineCard
              key={index}
              index={index}
              line={lines[index] ?? null}
              isWinner={lines[index]?.call.id === session.winnerCallId}
            />
          ))}
        </div>

        <AttemptTimeline history={history} winnerCallId={session.winnerCallId} />
      </div>

      <div className="flex flex-col gap-5">
        <AnimatePresence mode="wait">
          {winner ? (
            <motion.div
              key="winner"
              initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              <WinnerCard winner={winner} />
            </motion.div>
          ) : (
            <QueuePreview key="queue" upNext={upNext} status={session.status} />
          )}
        </AnimatePresence>

        <ActivityFeed activities={activities} history={history} />

        <div className="flex gap-3">
          {session.status === 'RUNNING' ? (
            <Button variant="outline" size="sm" onClick={onStop} className="flex-1">
              <PhoneOff className="size-4" aria-hidden />
              Stop session
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onReset} className="flex-1">
              New session
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hero card: total attempts plus the three outcome buckets.
 *
 * @param props the polled session view
 * @returns the session card
 */
function SessionCard({ view }: { view: SessionView }) {
  const { metrics, status } = view.session;
  const tiles = [
    { label: 'Connected', value: metrics.connected, tone: 'text-pos' },
    { label: 'Failed', value: metrics.failed, tone: 'text-muted' },
    { label: 'Canceled', value: metrics.canceled, tone: 'text-muted' },
  ];

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex items-start justify-between">
        <div>
          <CardLabel>Attempts</CardLabel>
          <p className="tnum mt-1 text-5xl font-bold tracking-tight">
            {metrics.attempted}
            <span className="ml-2 text-lg font-medium text-muted">
              of {metrics.attempted + view.upNext.length}
            </span>
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium',
            status === 'RUNNING' ? 'bg-accent text-accent-ink' : 'bg-ink/5 text-muted'
          )}
        >
          {status === 'RUNNING' ? 'Running' : 'Stopped'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[var(--radius-tile)] bg-bg p-4">
            <p className={cn('tnum text-2xl font-semibold', tile.tone)}>{tile.value}</p>
            <p className="mt-0.5 text-xs text-muted">{tile.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * One of the two dialer lines.
 *
 * @param props the line index and its current call, if any
 * @returns the line card
 */
function LineCard({
  index,
  line,
  isWinner,
}: {
  index: number;
  line: LineView | null;
  isWinner: boolean;
}) {
  return (
    <Card className={cn('p-6', isWinner && 'ring-2 ring-accent')}>
      <div className="flex items-center justify-between">
        <CardLabel>
          Line {index + 1}
          {isWinner && <span className="ml-2 text-ink">· on the line</span>}
        </CardLabel>
        {line ? (
          <StatusBadge status={line.call.status} />
        ) : (
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs text-muted">Idle</span>
        )}
      </div>

      {line ? (
        <div className="mt-4">
          <p className="font-semibold">{line.lead.name}</p>
          <p className="text-sm text-muted">{line.lead.company}</p>
          <p className="tnum mt-3 text-sm text-muted">{line.lead.phone}</p>
          <div className="mt-3">
            <CrmSyncBadge status={line.crmSyncStatus} />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Waiting for the next lead.</p>
      )}
    </Card>
  );
}

/**
 * One bar per attempt, scaled by how long the call lasted.
 *
 * Duration is the only real quantity a mocked call produces, so it is what the
 * chart shows. Height alone would be ambiguous, so colour encodes the outcome
 * and every bar carries a text tooltip.
 *
 * @param props every call in the session plus the current winner
 * @returns the timeline card
 */
function AttemptTimeline({
  history,
  winnerCallId,
}: {
  history: LineView[];
  winnerCallId: string | null;
}) {
  // history is newest-first; a timeline reads oldest-first.
  const bars = [...history].reverse().map((line) => ({
    line,
    seconds: durationSeconds(line.call),
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
                // rendering as nothing.
                style={{ height: `${String(Math.max(8, (seconds / longest) * 100))}%` }}
                title={`${line.lead.name} — ${CALL_STATUS_STYLES[line.call.status].label} — ${String(seconds)}s`}
              />
              <span className="tnum text-center text-[10px] text-muted">
                {seconds}s
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * How long a call ran, in whole seconds.
 *
 * @param call the call to measure
 * @returns seconds elapsed, or 0 while it is still ringing
 */
function durationSeconds(call: LineView['call']): number {
  if (call.endedAt === null) return 0;
  const ms = Date.parse(call.endedAt) - Date.parse(call.startedAt);
  return Math.max(0, Math.round(ms / 1000));
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

/**
 * The connected call — "Show winner call (if connected)".
 *
 * Read-only. The brief writes disposition and notes automatically when a call
 * reaches a terminal outcome, so there is nothing here for an agent to fill
 * in; the conversation ends on its own and syncs itself.
 *
 * @param props the winning line
 * @returns the winner card
 */
function WinnerCard({ winner }: { winner: LineView }) {
  const seconds = useElapsed(winner.call.startedAt);

  return (
    <Card className="overflow-hidden bg-ink p-6 text-white">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-white/60">
          <PhoneCall className="size-3.5" aria-hidden />
          On the line
        </span>
        <span className="tnum text-sm text-white/80" aria-label="Time on this call">
          {formatDuration(seconds)}
        </span>
      </div>

      <p className="mt-4 text-xl font-semibold">{winner.lead.name}</p>
      <p className="text-sm text-white/60">{winner.lead.company}</p>
      <p className="tnum mt-4 text-sm text-white/80">{winner.lead.phone}</p>

      <p className="mt-5 border-t border-white/10 pt-4 text-xs text-white/50">
        The activity is written when the call ends.
      </p>
    </Card>
  );
}

/**
 * Seconds since a timestamp, ticking every second.
 *
 * The dashboard polls at 1.5s, which would make a call timer jump in uneven
 * steps. This is local so it counts smoothly.
 *
 * @param startedAt when the call began
 * @returns whole seconds elapsed
 */
function useElapsed(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);

  return Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));
}

/**
 * Formats seconds as m:ss.
 *
 * @param seconds elapsed whole seconds
 * @returns e.g. "1:07"
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${String(mins)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Leads waiting to be dialed.
 *
 * @param props the queued leads and the session status
 * @returns the queue card
 */
function QueuePreview({
  upNext,
  status,
}: {
  upNext: SessionView['upNext'];
  status: SessionView['session']['status'];
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted" aria-hidden />
        <CardLabel>Up next</CardLabel>
      </div>

      {upNext.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {status === 'RUNNING' ? 'Queue empty — finishing active calls.' : 'Queue empty.'}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {upNext.slice(0, 5).map((lead, index) => (
            <li key={lead.id} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  index === 0 ? 'bg-accent text-accent-ink' : 'bg-bg text-muted'
                )}
              >
                {lead.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{lead.name}</span>
                <span className="block truncate text-xs text-muted">{lead.company}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * CRM activities as they are written, newest first.
 *
 * @param props the activities from the polled view
 * @returns the feed card
 */
function ActivityFeed({
  activities,
  history,
}: {
  activities: SessionView['activities'];
  history: LineView[];
}) {
  const reduceMotion = useReducedMotion();

  // An activity carries a leadId, not a name. The session's own history is
  // already hydrated with leads, so resolve against that rather than making
  // the API send the name twice.
  const leadNameById = new Map(history.map((line) => [line.lead.id, line.lead.name]));

  return (
    <Card className="p-6">
      <CardLabel>CRM activity</CardLabel>

      {activities.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing written yet. Activities appear as calls finish.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {activities.slice(0, 6).map((activity) => (
              <motion.li
                key={activity.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {leadNameById.get(activity.leadId) ?? 'Unknown lead'}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {DISPOSITION_LABELS[activity.disposition]}
                    {activity.notes ? ` · ${activity.notes}` : ''}
                  </span>
                </span>
                <span className="tnum shrink-0 text-xs text-muted">
                  {new Date(activity.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}
