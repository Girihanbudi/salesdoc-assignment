import { ApiFailureSchema, MetaSchema, type ErrorDetail } from '@salesdoc/shared';
import { z } from 'zod';

/**
 * The client's whole HTTP layer: one place that calls the API, one place that
 * decides what a failure means.
 *
 * This mirrors `server/error-handler.ts`. Bundling the transport and the
 * translation together is deliberate — if a component could fetch without
 * going through here, it would end up writing its own error wording, and the
 * two would drift.
 */

/** Thrown for any non-2xx response, carrying the API's machine-readable code. */
export class ApiError extends Error {
  readonly code: string;
  /** Per-field validation failures, when the cause was a bad request. */
  readonly details: ErrorDetail[] | undefined;

  /**
   * @param code the API's error code, e.g. `SESSION.NOT_FOUND`
   * @param message the server's own wording, for logs — not for display
   * @param details per-field validation failures, when there were any
   */
  constructor(code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

/** What the UI shows for a failure. */
export interface UserMessage {
  /** One line. What happened, in the user's terms. */
  title: string;
  /** Optional second line: what to do next, or why it happened. */
  detail?: string;
}

/**
 * Every code the API can return, mapped to something a person can act on.
 *
 * Codes are the contract; this wording is not, and can change freely.
 */
const MESSAGES: Record<string, UserMessage> = {
  NETWORK: {
    title: 'Cannot reach the server',
    detail: 'The API is not responding. If it is waking from idle this can take ~30s.',
  },
  VALIDATION_FAILED: { title: 'That request was not valid' },
  'LEAD.UNKNOWN': {
    title: 'One of those leads no longer exists',
    detail: 'Refresh the list and try again.',
  },
  'LEAD.NOT_FOUND': {
    title: 'That lead no longer exists',
    detail: 'Refresh the list and try again.',
  },
  'SESSION.NOT_FOUND': {
    title: 'That session no longer exists',
    detail: 'The server restarts clear in-memory state. Start a new session.',
  },
  'AGENT.BUSY': {
    title: 'You already have a session running',
    detail: 'Finish or stop it before starting another.',
  },
  'CALL.NOT_ACTIVE': {
    title: 'That call is no longer on the line',
    detail: 'It ended before the wrap-up was saved.',
  },
  NOT_FOUND: { title: 'That page or endpoint does not exist' },
  INTERNAL: {
    title: 'Oops — something went wrong on our end',
    detail: 'Nothing you did caused this. Try again in a moment.',
  },
};

/** Shown when the code is missing or unrecognised. */
const FALLBACK: UserMessage = {
  title: 'Oops — something went wrong',
  detail: 'Try again in a moment.',
};

/**
 * Turns anything thrown into a message worth showing.
 *
 * An unmapped code falls back to a generic apology rather than leaking a raw
 * server string — but the code is appended, because a user quoting
 * "INTERNAL" is far more use in a bug report than one quoting
 * "Failed to fetch".
 *
 * @param cause whatever was thrown
 * @param fallbackTitle context-specific wording, e.g. 'Could not start the session'
 * @returns the title and detail to display
 */
export function toUserMessage(cause: unknown, fallbackTitle?: string): UserMessage {
  if (!(cause instanceof ApiError)) {
    return { ...FALLBACK, title: fallbackTitle ?? FALLBACK.title };
  }

  const known = MESSAGES[cause.code];
  if (!known) {
    return {
      title: fallbackTitle ?? FALLBACK.title,
      detail: `Unexpected error (${cause.code}).`,
    };
  }

  // A validation failure names the offending fields, which beats any wording
  // written in advance.
  if (cause.code === 'VALIDATION_FAILED' && cause.details && cause.details.length > 0) {
    const fields = cause.details
      .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
      .join('; ');
    return { title: known.title, detail: fields };
  }

  return known;
}

/** The envelope's own shape. The payload inside is checked separately. */
const SuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: MetaSchema,
});

/**
 * Performs the fetch, converting an unreachable server into an `ApiError`.
 *
 * @param path the path to call
 * @param init fetch options
 * @returns the response
 * @throws ApiError with code NETWORK when the request never landed
 */
async function send(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      ...(init?.body ? { headers: { 'content-type': 'application/json' } } : {}),
    });
  } catch {
    // fetch rejects with a bare TypeError("Failed to fetch") when the server is
    // unreachable, which tells a user nothing.
    throw new ApiError('NETWORK', 'fetch failed');
  }
}

/**
 * Calls one of our endpoints and unwraps the response envelope.
 *
 * Unwrapping here is why nothing else in the app knows the envelope exists:
 * callers receive plain domain data.
 *
 * @param schema the expected payload shape
 * @param path the API path
 * @param init fetch options
 * @returns the parsed payload
 * @throws ApiError on any non-2xx response
 */
export async function request<T>(
  schema: z.ZodType<T>,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await send(path, init);
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const failure = ApiFailureSchema.safeParse(body);
    throw failure.success
      ? new ApiError(failure.data.error.code, failure.data.error.message, failure.data.error.details)
      : new ApiError('INTERNAL', `Request failed (${res.status})`);
  }

  // Two layers because a generic payload schema does not survive zod's
  // inference inside a wrapper: the envelope is checked structurally, then the
  // payload against its own schema.
  const enveloped = SuccessEnvelopeSchema.parse(body);
  return schema.parse(enveloped.data);
}

/**
 * Calls an endpoint that is NOT ours and so carries no envelope.
 *
 * Only the mock CRM uses this. A separate function rather than a flag, so the
 * two contracts cannot be confused at a call site.
 *
 * @param schema the expected response shape
 * @param path the path to call
 * @returns the parsed body
 */
export async function rawRequest<T>(schema: z.ZodType<T>, path: string): Promise<T> {
  const res = await send(path);
  if (!res.ok) throw new ApiError('INTERNAL', `Request failed (${res.status})`);
  return schema.parse(await res.json());
}
