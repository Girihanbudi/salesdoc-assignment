import type { Disposition, LineView, SessionView } from '@salesdoc/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PhoneOff, PhoneCall, Users } from 'lucide-react';
import { useState } from 'react';
import { CrmSyncBadge, StatusBadge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardLabel } from '@/components/ui/card.js';
import { cn } from '@/lib/utils.js';

/** Dispositions the agent can pick when wrapping up a live call. */
const AGENT_DISPOSITIONS: Disposition[] = ['INTERESTED', 'CALLBACK', 'NOT_INTERESTED'];

const DISPOSITION_LABELS: Record<Disposition, string> = {
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
  onEndCall: (callId: string, outcome: { disposition: Disposition; notes: string }) => void;
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
export function Dashboard({ view, onEndCall, onStop, onReset, busy }: DashboardProps) {
  const { session, lines, winner, history, upNext, activities } = view;
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_352px]">
      <div className="flex flex-col gap-5">
        <SessionCard view={view} />

        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <LineCard key={index} index={index} line={lines[index] ?? null} />
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
              <WinnerCard winner={winner} onEndCall={onEndCall} busy={busy} />
            </motion.div>
          ) : (
            <QueuePreview key="queue" upNext={upNext} status={session.status} />
          )}
        </AnimatePresence>

        <ActivityFeed activities={activities} />

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
    <Card className="p-7">
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
function LineCard({ index, line }: { index: number; line: LineView | null }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <CardLabel>Line {index + 1}</CardLabel>
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
 * Bar-per-attempt timeline. The winner's bar is the only lime one.
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
  const bars = [...history].reverse();

  return (
    <Card className="p-7">
      <CardLabel>Attempts</CardLabel>
      {bars.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No calls placed yet.</p>
      ) : (
        <ul className="mt-6 flex h-28 items-end gap-2">
          {bars.map((line) => {
            const isWinner = line.call.id === winnerCallId;
            const connected = line.call.status === 'CONNECTED';
            return (
              <li
                key={line.call.id}
                className="group relative flex-1"
                title={`${line.lead.name} — ${line.call.status}`}
              >
                <div
                  className={cn(
                    'w-full rounded-t-lg transition-colors',
                    isWinner || connected ? 'bg-accent' : 'bg-ink/10'
                  )}
                  style={{ height: connected ? '100%' : '55%' }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * The connected call holding the agent. The one dark surface on the page.
 *
 * @param props the winning line and the wrap-up handler
 * @returns the winner card
 */
function WinnerCard({
  winner,
  onEndCall,
  busy,
}: {
  winner: LineView;
  onEndCall: DashboardProps['onEndCall'];
  busy: boolean;
}) {
  const [disposition, setDisposition] = useState<Disposition>('INTERESTED');
  const [notes, setNotes] = useState('');

  return (
    <Card className="overflow-hidden bg-ink p-0 text-white">
      <div className="p-6">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <PhoneCall className="size-3.5" aria-hidden />
          On the line
        </div>
        <p className="mt-3 text-xl font-semibold">{winner.lead.name}</p>
        <p className="text-sm text-white/60">{winner.lead.company}</p>
        <p className="tnum mt-4 text-sm text-white/80">{winner.lead.phone}</p>
      </div>

      <div className="bg-card p-6 text-ink">
        <fieldset>
          <legend className="text-sm font-medium">Disposition</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {AGENT_DISPOSITIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={disposition === option}
                onClick={() => setDisposition(option)}
                className={cn(
                  'rounded-[var(--radius-tile)] px-2 py-3 text-xs font-medium transition-colors',
                  disposition === option
                    ? 'bg-ink text-white'
                    : 'bg-bg text-muted hover:bg-ink/10'
                )}
              >
                {DISPOSITION_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>

        <label htmlFor="call-notes" className="mt-5 block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="call-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="What was agreed?"
          className="mt-2 w-full resize-none rounded-[var(--radius-tile)] bg-bg p-3 text-sm outline-none placeholder:text-muted"
        />

        <Button
          className="mt-4 w-full"
          disabled={busy}
          onClick={() => onEndCall(winner.call.id, { disposition, notes })}
        >
          End call & save to CRM
        </Button>
      </div>
    </Card>
  );
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
function ActivityFeed({ activities }: { activities: SessionView['activities'] }) {
  const reduceMotion = useReducedMotion();

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
                    {DISPOSITION_LABELS[activity.disposition]}
                  </span>
                  <span className="block truncate text-xs text-muted">{activity.notes}</span>
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
