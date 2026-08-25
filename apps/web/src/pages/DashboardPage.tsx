import type { CRMActivity, DialerSession } from '@salesdoc/shared';
import { Activity, ArrowUpRight, ListOrdered, PhoneCall, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardLabel } from '@/components/ui/card.js';
import { PATHS } from '@/routes/paths.js';

/** Props for {@link DashboardPage}. */
export interface DashboardPageProps {
  leadCount: number;
  sessions: DialerSession[];
  activities: CRMActivity[];
  /** The session this browser started and is polling, if any. */
  activeSessionId: string | null;
}

/**
 * The index: one card per area, each a link into it.
 *
 * Every number shown is real. A tile that always reads zero because nothing
 * feeds it is worse than no tile.
 *
 * @param props counts and the most recent session
 * @returns the dashboard
 */
export function DashboardPage({
  leadCount,
  sessions,
  activities,
  activeSessionId,
}: DashboardPageProps) {
  // Prefer the session this browser is actually running. Falling straight to
  // "newest on the server" would point an agent at somebody else's session
  // once there is more than one.
  const active =
    sessions.find((s) => s.id === activeSessionId) ??
    sessions.find((s) => s.status === 'RUNNING') ??
    sessions[0] ??
    null;

  const isLive = active !== null && active.status === 'RUNNING';

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <NavCard
        to={PATHS.dial}
        icon={Users}
        label="Leads"
        value={String(leadCount)}
        hint="Pick leads and start dialing"
      />

      <NavCard
        // A live session opens the dialer, where it keeps updating; a finished
        // one opens its log, which is all that is left to see.
        to={
          active === null
            ? PATHS.dial
            : isLive
              ? `${PATHS.dial}?session=${active.id}`
              : PATHS.session(active.id)
        }
        icon={PhoneCall}
        label={isLive ? 'Active session' : 'Last session'}
        value={active === null ? '—' : `${String(active.metrics.attempted)} attempts`}
        hint={
          active === null
            ? 'No session yet — start one'
            : isLive
              ? `${String(active.metrics.connected)} connected · still dialing`
              : 'Finished · view the log'
        }
        highlight={isLive}
      />

      <NavCard
        to={PATHS.crmActivities}
        icon={Activity}
        label="CRM activity"
        value={String(activities.length)}
        hint="Everything written to the CRM"
      />

      <NavCard
        to={PATHS.sessions}
        icon={ListOrdered}
        label="Sessions"
        value={String(sessions.length)}
        hint="History and per-session call logs"
      />
    </div>
  );
}

/**
 * One tile on the index.
 *
 * A whole-card link rather than a button inside it, so the entire target is
 * clickable and keyboard focus lands once.
 *
 * @param props destination, icon, and the figures to show
 * @returns the card
 */
function NavCard({
  to,
  icon: Icon,
  label,
  value,
  hint,
  highlight = false,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Card
        className={`h-full p-6 transition-shadow group-hover:shadow-lg ${
          highlight ? 'ring-2 ring-accent' : ''
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="grid size-10 place-items-center rounded-[var(--radius-tile)] bg-bg">
            <Icon className="size-[18px] text-ink" aria-hidden />
          </span>
          <ArrowUpRight
            className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>

        <CardLabel className="mt-5">{label}</CardLabel>
        <p className="tnum mt-1 text-3xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </Card>
    </Link>
  );
}
