import {
  DialerSessionSchema,
  LeadSchema,
  SessionViewSchema,
  type Disposition,
  type DialerSession,
  type Lead,
  type SessionView,
} from '@salesdoc/shared';
import { z } from 'zod';

/**
 * Calls the API and validates the response against a schema.
 *
 * Parsing on the way in means a backend contract change surfaces here as one
 * clear error rather than as `undefined` deep inside a component.
 *
 * @param schema the expected response shape
 * @param path the API path
 * @param init fetch options
 * @returns the parsed body
 * @throws when the request fails or the body does not match the schema
 */
async function request<T>(
  schema: z.ZodType<T>,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    ...(init?.body ? { headers: { 'content-type': 'application/json' } } : {}),
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: { message?: string } }).error.message)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return schema.parse(await res.json());
}

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
  return request(DialerSessionSchema, `/api/sessions/${sessionId}/start`, {
    method: 'POST',
  });
}

/**
 * Stops a session and cancels its active calls.
 *
 * @param sessionId the session to stop
 * @returns the updated session
 */
export function stopSession(sessionId: string): Promise<DialerSession> {
  return request(DialerSessionSchema, `/api/sessions/${sessionId}/stop`, {
    method: 'POST',
  });
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
  return request(
    DialerSessionSchema,
    `/api/sessions/${sessionId}/calls/${callId}/end`,
    { method: 'POST', body: JSON.stringify(outcome) }
  );
}
