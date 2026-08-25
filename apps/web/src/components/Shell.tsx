import { Activity, LayoutGrid, ListOrdered, PhoneCall, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import * as api from '@/api.js';
import { usePoll } from '@/hooks/usePoll.js';
import { cn } from '@/lib/utils.js';
import { PATHS } from '@/routes/paths.js';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
}

// Only destinations that exist. A rail of decorative icons that go nowhere
// looks finished and isn't.
const NAV: NavItem[] = [
  { to: PATHS.dashboard, label: 'Dashboard', icon: LayoutGrid },
  { to: PATHS.dial, label: 'Dialer', icon: PhoneCall },
  { to: PATHS.sessions, label: 'Sessions', icon: ListOrdered },
  { to: PATHS.crmActivities, label: 'CRM activity', icon: Activity },
];

/** Props for {@link Shell}. */
export interface ShellProps {
  title: string;
  subtitle: string;
  /** Rendered beside the heading. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Page chrome: floating icon rail, top bar, and the greeting block.
 *
 * @param props the active view, navigation handler, heading text, and content
 * @returns the page frame around `children`
 */
export function Shell({ title, subtitle, actions, children }: ShellProps) {
  return (
    <div className="min-h-screen">
      <TopBar />

      <div className="mx-auto flex max-w-[86rem] gap-5 px-5 pb-12">
        <Rail />

        <main className="min-w-0 flex-1 pt-2">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold">{title}</h1>
              <p className="mt-2 text-muted">{subtitle}</p>
            </div>
            {actions}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Brand mark: the product's initial, not an imported logo.
 *
 * @returns the mark
 */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid size-9 place-items-center rounded-[12px] bg-accent text-lg font-bold text-accent-ink"
    >
      S
    </span>
  );
}

/**
 * Top bar: brand, centred segmented nav, and the agent badge.
 *
 * @returns the top bar
 */
function TopBar() {
  return (
    <div className="mx-auto flex max-w-[86rem] items-center justify-between gap-4 px-5 py-5">
      <div className="flex items-center gap-3">
        <BrandMark />
        <span className="text-lg font-semibold tracking-tight">SalesDoc</span>
      </div>

      <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-card shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <AgentBadge />
    </div>
  );
}

/**
 * Who the app is running as.
 *
 * Fetched once rather than polled — the agent does not change while you look
 * at it. Renders nothing until it arrives, so the bar does not flash a
 * placeholder name.
 *
 * @returns the agent chip
 */
function AgentBadge() {
  const agent = usePoll(api.getAgent, 0);

  if (agent.data === null) return <span className="size-9" aria-hidden />;

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted sm:inline">{agent.data.name}</span>
      <span
        title={agent.data.email}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-medium text-white"
      >
        {agent.data.initials}
      </span>
    </div>
  );
}

/**
 * Floating icon rail. Icon-only, so every item carries an accessible name.
 *
 * @returns the rail
 */
function Rail() {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-5 hidden h-fit flex-col items-center gap-2 rounded-full bg-card p-2 shadow-[var(--shadow-card)] md:flex"
    >
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.label}
          aria-label={item.label}
          className={({ isActive }) =>
            cn(
              'grid size-11 place-items-center rounded-full transition-colors',
              isActive ? 'bg-ink text-white' : 'text-muted hover:bg-black/5 hover:text-ink'
            )
          }
        >
          <item.icon className="size-[18px]" aria-hidden />
        </NavLink>
      ))}

      <span className="my-1 h-px w-6 bg-line" aria-hidden />

      <span
        title="Settings — not part of this exercise"
        className="grid size-11 cursor-not-allowed place-items-center rounded-full text-muted/40"
      >
        <Settings className="size-[18px]" aria-hidden />
      </span>
    </nav>
  );
}
