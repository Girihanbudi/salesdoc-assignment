import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Shell } from '@/components/Shell.js';
import { Snackbar } from '@/components/ui/snackbar.js';
import { useActiveSession } from '@/hooks/useActiveSession.js';
import { ToastProvider, useToast } from '@/hooks/useToasts.js';
import { AppRoutes } from '@/routes/AppRoutes.js';
import { PATHS } from '@/routes/paths.js';

/** Heading per route. Longest-prefix entries come first. */
const HEADINGS: { match: (path: string) => boolean; title: string; subtitle: string }[] = [
  {
    match: (p) => p.startsWith('/crm-activities/'),
    title: 'CRM activity',
    subtitle: 'One record, with the lead and the call behind it.',
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

const FALLBACK_HEADING = { title: 'Not found', subtitle: 'That page does not exist.' };

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

  return (
    <>
      <Shell title={heading.title} subtitle={heading.subtitle}>
        <AppRoutes
          activeSessionId={activeSession.sessionId}
          onSessionStarted={activeSession.remember}
          onSessionFinished={activeSession.forget}
        />
      </Shell>

      <Snackbar toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </>
  );
}
