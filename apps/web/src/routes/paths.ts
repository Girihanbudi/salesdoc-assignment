/**
 * Every route in the app, in one place.
 *
 * Builders rather than string literals at call sites: a renamed route is then
 * a compile error instead of a dead link nobody clicks until a demo.
 */
export const PATHS = {
  dashboard: '/dashboard',
  dial: '/dial',
  crmActivities: '/crm-activities',
  crmActivity: (callId: string) => `/crm-activities/${callId}`,
  sessions: '/sessions',
  session: (sessionId: string) => `/sessions/${sessionId}`,
} as const;

/** The route patterns react-router matches against. */
export const PATTERNS = {
  dashboard: '/dashboard',
  dial: '/dial',
  crmActivities: '/crm-activities',
  crmActivity: '/crm-activities/:callId',
  sessions: '/sessions',
  session: '/sessions/:sessionId',
} as const;
