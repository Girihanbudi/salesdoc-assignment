import { Activity, LayoutGrid, PhoneCall, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

/** The screens the rail can reach. */
export type View = 'dialer' | 'crm';

interface NavItem {
  view: View;
  label: string;
  icon: typeof LayoutGrid;
}

// Only destinations that exist. A rail of decorative icons that go nowhere
// looks finished and isn't.
const NAV: NavItem[] = [
  { view: 'dialer', label: 'Dialer', icon: PhoneCall },
  { view: 'crm', label: 'CRM activity', icon: Activity },
];

/** Props for {@link Shell}. */
export interface ShellProps {
  view: View;
  onNavigate: (view: View) => void;
  title: string;
  subtitle: string;
  /** Rendered at the top right, beside the agent badge. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Page chrome: floating icon rail, top bar, and the greeting block.
 *
 * @param props the active view, navigation handler, heading text, and content
 * @returns the page frame around `children`
 */
export function Shell({ view, onNavigate, title, subtitle, actions, children }: ShellProps) {
  return (
    <div className="min-h-screen">
      <TopBar view={view} onNavigate={onNavigate} />

      <div className="mx-auto flex max-w-[86rem] gap-5 px-5 pb-12">
        <Rail view={view} onNavigate={onNavigate} />

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
 * @param props the active view and navigation handler
 * @returns the top bar
 */
function TopBar({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return (
    <div className="mx-auto flex max-w-[86rem] items-center justify-between gap-4 px-5 py-5">
      <div className="flex items-center gap-3">
        <BrandMark />
        <span className="text-lg font-semibold tracking-tight">SalesDoc</span>
      </div>

      <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
        {NAV.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => onNavigate(item.view)}
            aria-current={view === item.view ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              view === item.view
                ? 'bg-card shadow-[var(--shadow-card)]'
                : 'text-muted hover:text-ink'
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">agent-1</span>
        <span
          aria-hidden
          className="grid size-9 place-items-center rounded-full bg-ink text-sm font-medium text-white"
        >
          A
        </span>
      </div>
    </div>
  );
}

/**
 * Floating icon rail. Icon-only, so every item carries an accessible name.
 *
 * @param props the active view and navigation handler
 * @returns the rail
 */
function Rail({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-5 hidden h-fit flex-col items-center gap-2 rounded-full bg-card p-2 shadow-[var(--shadow-card)] md:flex"
    >
      {NAV.map((item) => {
        const active = view === item.view;
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => onNavigate(item.view)}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'grid size-11 place-items-center rounded-full transition-colors',
              active ? 'bg-ink text-white' : 'text-muted hover:bg-black/5 hover:text-ink'
            )}
          >
            <item.icon className="size-[18px]" aria-hidden />
          </button>
        );
      })}

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
