import {
  ApiFailureSchema,
  DialerSessionSchema,
  LeadSchema,
  MetaSchema,
  SessionViewSchema,
  type Disposition,
  type DialerSession,
  type Lead,
  type SessionView,
} from '@salesdoc/shared';
import { z } from 'zod';

/** Thrown for any non-2xx response, carrying the API's machine-readable code. */
export class ApiError extends Error {
  readonly code: string;
  readonly details: { path: string; message: string }[] | undefined;

  /**
   * @param code the API's error code, e.g. `SESSION.NOT_FOUND`
   * @param message human-readable explanation
   * @param details per-field validation failures, when there were any
   */
  constructor(
    code: string,
    message: string,
    details?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

/** The envelope's own shape. The payload inside is checked separately. */
const SuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: MetaSchema,
});

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

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const failure = ApiFailureSchema.safeParse(body);
    throw failure.success
      ? new ApiError(
          failure.data.error.code,
          failure.data.error.message,
          failure.data.error.details
        )
      : new ApiError('UNKNOWN', `Request failed (${res.status})`);
  }

  // Checked in two layers because a generic payload schema does not survive
  // zod's inference inside a wrapper: the envelope is validated structurally,
  // then the payload against its own schema.
  const enveloped = SuccessEnvelopeSchema.parse(body);
  return schema.parse(enveloped.data);
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
