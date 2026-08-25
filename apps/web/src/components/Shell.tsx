import { Activity, LayoutGrid, ListOrdered, Menu, PhoneCall, Settings, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  /** Rendered above the heading — breadcrumbs on nested pages. */
  breadcrumbs?: ReactNode;
  /** Rendered beside the heading. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Page chrome: icon rail, top bar, and the heading block.
 *
 * Below `md` the rail is gone and the nav lives behind a burger, because a
 * fixed 72px rail plus card padding leaves almost nothing for content on a
 * phone.
 *
 * @param props heading text, optional breadcrumbs and actions, and the content
 * @returns the page frame around `children`
 */
export function Shell({ title, subtitle, breadcrumbs, actions, children }: ShellProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Navigating from inside the menu must close it, or the destination renders
  // underneath a still-open overlay.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <TopBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="mx-auto flex max-w-[86rem] gap-5 px-4 pb-12 sm:px-5">
        <Rail />

        <main className="min-w-0 flex-1 pt-2">
          <header className="mb-7">
            {breadcrumbs}
            <div className="flex flex-wrap items-end justify-between gap-4">
              {/* Keyed on the title so it crossfades with the page below it.
                  Without this the heading snaps to the new page's words while
                  the body is still fading out the old one. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  // Both, because a list and its detail page share a title and
                  // differ only in the line beneath it.
                  key={`${title}|${subtitle}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                  className="min-w-0"
                >
                  <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
                  <p className="mt-2 text-muted">{subtitle}</p>
                </motion.div>
              </AnimatePresence>
              {actions}
            </div>
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
      className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-accent text-lg font-bold text-accent-ink"
    >
      S
    </span>
  );
}

/**
 * Top bar: burger on small screens, brand, centred nav, and the agent badge.
 *
 * @param props whether the menu is open and how to toggle it
 * @returns the top bar
 */
function TopBar({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  return (
    <div className="mx-auto flex max-w-[86rem] items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-black/5 md:hidden"
        >
          {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>

        <BrandMark />
        <span className="truncate text-lg font-semibold tracking-tight">SalesDoc</span>
      </div>

      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
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
 * The nav, as a sheet, for screens too narrow for the rail.
 *
 * @param props whether it is open and how to close it
 * @returns the menu overlay
 */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();

  // A background that scrolls behind an open overlay is disorienting on touch.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape is what a keyboard user reaches for, and the backdrop cannot be
  // focused.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          // A dialog, not a second nav: the rail is still in the DOM behind
          // this (only CSS-hidden), so two elements both labelled "Sections"
          // would be announced to a screen reader on a narrow viewport.
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-40 md:hidden"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
        >
          {/* Not a button: it would duplicate the X in the accessibility
              tree, and a click-to-dismiss backdrop is unreachable by keyboard
              anyway. Escape is the keyboard equivalent, handled above. */}
          <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/20" />

          <nav
            id="mobile-menu"
            className="absolute inset-x-4 top-4 rounded-[var(--radius-card)] bg-card p-3 shadow-[var(--shadow-card)]"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[var(--radius-tile)] px-4 py-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'
                  )
                }
              >
                <item.icon className="size-[18px]" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
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
    <div className="flex shrink-0 items-center gap-3">
      <span className="hidden text-sm text-muted lg:inline">{agent.data.name}</span>
      <span
        title={`${agent.data.name} · ${agent.data.email}`}
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
 * Hidden below `md`, where the burger menu takes over.
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
