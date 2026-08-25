import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import * as api from '@/api.js';
import { AsyncView } from '@/components/AsyncView.js';
import { usePoll } from '@/hooks/usePoll.js';
import { CrmActivitiesPage } from '@/pages/CrmActivitiesPage.js';
import { CrmActivityDetailPage } from '@/pages/CrmActivityDetailPage.js';
import { DashboardPage } from '@/pages/DashboardPage.js';
import { DialPage } from '@/pages/DialPage.js';
import { NotFoundPage } from '@/pages/NotFoundPage.js';
import { SessionDetailPage } from '@/pages/SessionDetailPage.js';
import { SessionsPage } from '@/pages/SessionsPage.js';
import { PATHS, PATTERNS } from '@/routes/paths.js';
import { useCallback } from 'react';

/** How often the non-live screens refresh. They are logs, not dashboards. */
const LIST_POLL_MS = 5000;

/** Props for {@link AppRoutes}. */
export interface AppRoutesProps {
  /** A session this browser started that has not finished, if any. */
  activeSessionId: string | null;
  /** Re-asks the server which session is running. */
  onSessionChanged: () => void;
}

/**
 * The route table.
 *
 * `/` redirects to the dashboard and anything unmatched falls to the 404,
 * so there is no URL that renders nothing.
 *
 * Pages cross-fade on navigation. Keyed on `pathname` rather than the whole
 * location, so changing `?session=` does **not** re-animate: that switch
 * happens mid-call, and flashing the screen while somebody is on the phone
 * would be the worst possible moment for it.
 *
 * `Routes` is given the frozen `location` so the outgoing page keeps rendering
 * its own content while it fades; without it, React Router swaps the match
 * immediately and both halves of the transition show the new page.
 *
 * @param props session-resume plumbing
 * @returns the routed content
 */
export function AppRoutes(props: AppRoutesProps) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
        // Short, and faster out than in: the wait for the exit is dead time
        // before the page the user asked for appears.
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        // Holds the document tall enough that the gap between pages does not
        // collapse the scroll height. Paired with scrollbar-gutter in the base
        // styles, navigation stops moving the layout at all.
        className="min-h-[60vh]"
      >
        <Routes location={location}>
          <Route path="/" element={<Navigate to={PATHS.dashboard} replace />} />
          <Route
            path={PATTERNS.dashboard}
            element={<DashboardRoute activeSessionId={props.activeSessionId} />}
          />
          <Route path={PATTERNS.dial} element={<DialPage {...props} />} />
          <Route path={PATTERNS.crmActivities} element={<ActivitiesRoute />} />
          <Route path={PATTERNS.crmActivity} element={<ActivityDetailRoute />} />
          <Route path={PATTERNS.sessions} element={<SessionsRoute />} />
          <Route path={PATTERNS.session} element={<SessionDetailRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Dashboard route — needs three lists to fill its tiles.
 *
 * @param props the session this browser is running, if any
 * @returns the dashboard, once its data is in
 */
function DashboardRoute({ activeSessionId }: { activeSessionId: string | null }) {
  const leads = usePoll(api.getLeads, LIST_POLL_MS);
  const sessions = usePoll(api.getSessions, LIST_POLL_MS);
  const activities = usePoll(api.getActivities, LIST_POLL_MS);

  return (
    <AsyncView state={sessions} empty="Nothing to show yet.">
      {(sessionList) => (
        <DashboardPage
          leadCount={leads.data?.length ?? 0}
          sessions={sessionList}
          activities={activities.data ?? []}
          activeSessionId={activeSessionId}
        />
      )}
    </AsyncView>
  );
}

/**
 * CRM activity list route.
 *
 * @returns the activity list
 */
function ActivitiesRoute() {
  const activities = usePoll(api.getActivities, LIST_POLL_MS);

  return (
    <AsyncView state={activities} empty="Nothing written yet.">
      {(data) => <CrmActivitiesPage activities={data} />}
    </AsyncView>
  );
}

/**
 * CRM activity detail route, keyed by the call that produced it.
 *
 * @returns the activity detail
 */
function ActivityDetailRoute() {
  const { callId = '' } = useParams();
  const detail = usePoll(
    useCallback(() => api.getActivityDetail(callId), [callId]),
    0
  );

  return (
    <AsyncView state={detail} empty="No activity for that call.">
      {(data) => <CrmActivityDetailPage detail={data} />}
    </AsyncView>
  );
}

/**
 * Session history route.
 *
 * @returns the session list
 */
function SessionsRoute() {
  const sessions = usePoll(api.getSessions, LIST_POLL_MS);

  return (
    <AsyncView state={sessions} empty="No sessions yet.">
      {(data) => <SessionsPage sessions={data} />}
    </AsyncView>
  );
}

/**
 * Session detail route.
 *
 * Polls, because a session opened while it is still running should keep
 * updating rather than freeze at whatever it showed on arrival.
 *
 * @returns the session log
 */
function SessionDetailRoute() {
  const { sessionId = '' } = useParams();
  const detail = usePoll(
    useCallback(() => api.getSessionDetail(sessionId), [sessionId]),
    LIST_POLL_MS
  );

  return (
    <AsyncView state={detail} empty="Session not found.">
      {(data) => <SessionDetailPage detail={data} />}
    </AsyncView>
  );
}
