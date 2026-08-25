import {
  ActivityDetailSchema,
  CRMActivitySchema,
  CRMContactSchema,
  DialerSessionSchema,
  LeadSchema,
  SessionDetailSchema,
  SessionViewSchema,
  type ActivityDetail,
  type CRMActivity,
  type CRMContact,
  type DialerSession,
  type Disposition,
  type Lead,
  type SessionDetail,
  type SessionView,
} from '@salesdoc/shared';
import { z } from 'zod';
import { rawRequest, request } from '@/lib/fetcher.js';

/**
 * Every endpoint the client calls, and nothing else.
 *
 * Transport, envelope unwrapping, and error translation live in
 * `lib/fetcher.ts`; this file is only the list of URLs and their shapes.
 */

/**
 * Fetches the seeded leads.
 *
 * @returns every lead the backend knows about
 */
export function getLeads(): Promise<Lead[]> {
  return request(z.array(LeadSchema), '/api/leads');
}

/**
 * Creates a dialer session over the selected leads.
 *
 * @param leadIds the leads to queue, in order
 * @returns the new session
 */
export function createSession(leadIds: string[]): Promise<DialerSession> {
  return request(DialerSessionSchema, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ agentId: 'agent-1', leadIds }),
  });
}

/**
 * Starts dialing a session.
 *
 * @param sessionId the session to start
 * @returns the updated session
 */
export function startSession(sessionId: string): Promise<DialerSession> {
  return request(DialerSessionSchema, `/api/sessions/${sessionId}/start`, { method: 'POST' });
}

/**
 * Stops a session and cancels its active calls.
 *
 * @param sessionId the session to stop
 * @returns the updated session
 */
export function stopSession(sessionId: string): Promise<DialerSession> {
  return request(DialerSessionSchema, `/api/sessions/${sessionId}/stop`, { method: 'POST' });
}

/**
 * Fetches the fully hydrated session view the dashboard renders.
 *
 * @param sessionId the session to read
 * @returns lines, winner, history, queue, and activities
 */
export function getSessionView(sessionId: string): Promise<SessionView> {
  return request(SessionViewSchema, `/api/sessions/${sessionId}`);
}

/**
 * Wraps up the connected call so the agent's line frees.
 *
 * @param sessionId the session holding the call
 * @param callId the connected call
 * @param outcome the agent's disposition and notes
 * @returns the updated session
 */
export function endCall(
  sessionId: string,
  callId: string,
  outcome: { disposition: Disposition; notes: string }
): Promise<DialerSession> {
  return request(DialerSessionSchema, `/api/sessions/${sessionId}/calls/${callId}/end`, {
    method: 'POST',
    body: JSON.stringify(outcome),
  });
}

/**
 * Reads the mock CRM's contacts.
 *
 * Unenveloped: these stand in for a third party's API, so the response is
 * parsed as the bare array such a system would return.
 *
 * @returns every contact the mock CRM holds
 */
export function getCrmContacts(): Promise<CRMContact[]> {
  return rawRequest(z.array(CRMContactSchema), '/mock-crm/contacts');
}

/**
 * Reads the mock CRM's activities.
 *
 * @returns every activity the mock CRM holds
 */
export function getCrmActivities(): Promise<CRMActivity[]> {
  return rawRequest(z.array(CRMActivitySchema), '/mock-crm/activities');
}

/**
 * Lists every session this process has seen, newest first.
 *
 * @returns the session history
 */
export function getSessions(): Promise<DialerSession[]> {
  return request(z.array(DialerSessionSchema), '/api/sessions');
}

/**
 * Reads one session with every call and activity it produced.
 *
 * @param sessionId the session to read
 * @returns the session detail
 */
export function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  return request(SessionDetailSchema, `/api/sessions/${sessionId}/detail`);
}

/**
 * Lists our own record of every CRM activity, newest first.
 *
 * @returns the activities
 */
export function getActivities(): Promise<CRMActivity[]> {
  return request(z.array(CRMActivitySchema), '/api/activities');
}

/**
 * Reads one activity with the lead and call it concerns.
 *
 * @param callId the call that produced the activity
 * @returns the activity detail
 */
export function getActivityDetail(callId: string): Promise<ActivityDetail> {
  return request(ActivityDetailSchema, `/api/activities/${callId}`);
}
