import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Breadcrumbs, type Crumb } from '@/components/Breadcrumbs.js';
import { Shell } from '@/components/Shell.js';
import { Snackbar } from '@/components/ui/snackbar.js';
import { useActiveSession } from '@/hooks/useActiveSession.js';
import { ToastProvider, useToast } from '@/hooks/useToasts.js';
import { AppRoutes } from '@/routes/AppRoutes.js';
import { PATHS } from '@/routes/paths.js';

/** Heading and breadcrumb trail per route. Longest-prefix entries come first. */
const HEADINGS: {
  match: (path: string) => boolean;
  title: string;
  subtitle: string;
  /** Omitted on top-level pages: the rail already says where you are. */
  trail?: (path: string) => Crumb[];
}[] = [
  {
    match: (p) => p.startsWith('/crm-activities/'),
    title: 'CRM activity',
    subtitle: 'One record, with the lead and the call behind it.',
    trail: (p) => [
      { label: 'CRM activity', to: PATHS.crmActivities },
      { label: p.split('/').pop() ?? 'Record' },
    ],
  },
  {
    match: (p) => p === PATHS.crmActivities,
    title: 'CRM activity',
    subtitle: 'Everything written to the CRM, newest first.',
  },
  {
    match: (p) => p.startsWith('/sessions/'),
    title: 'Session log',
    subtitle: 'Every call this session placed. Open one for its CRM record.',
    trail: (p) => [
      { label: 'Sessions', to: PATHS.sessions },
      { label: p.split('/').pop() ?? 'Session' },
    ],
  },
  {
    match: (p) => p === PATHS.sessions,
    title: 'Sessions',
    subtitle: 'Every session this server has run.',
  },
  {
    match: (p) => p === PATHS.dial,
    title: 'Dialer',
    subtitle: 'Two lines dial at once. The first lead to answer takes the agent.',
  },
  {
    match: (p) => p === PATHS.dashboard,
    title: 'Dashboard',
    subtitle: 'Where things stand. Every card opens the area behind it.',
  },
];

const FALLBACK_HEADING: (typeof HEADINGS)[number] = {
  match: () => true,
  title: 'Not found',
  subtitle: 'That page does not exist.',
};

/**
 * Root component: router, page chrome, and the toast host.
 *
 * @returns the app
 */
export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppFrame />
      </ToastProvider>
    </BrowserRouter>
  );
}

/**
 * Everything inside the router, so it can read the current location.
 *
 * @returns the shell wrapping the routed page
 */
function AppFrame() {
  const toasts = useToast();
  const { pathname } = useLocation();

  const activeSession = useActiveSession();

  // Every route change starts at the top; without this, opening a detail page
  // from halfway down a long list lands mid-page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const heading = HEADINGS.find((h) => h.match(pathname)) ?? FALLBACK_HEADING;
  const trail = heading.trail?.(pathname) ?? null;

  return (
    <>
      <Shell
        title={heading.title}
        subtitle={heading.subtitle}
        breadcrumbs={trail === null ? undefined : <Breadcrumbs trail={trail} />}
      >
        <AppRoutes
          activeSessionId={activeSession.sessionId}
          onSessionChanged={activeSession.refresh}
        />
      </Shell>

      <Snackbar toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </>
  );
}
