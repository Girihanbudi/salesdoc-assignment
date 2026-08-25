import { ApiFailureSchema, MetaSchema } from '@salesdoc/shared';
import { z } from 'zod';
import { ApiError } from './api-error.js';

/**
 * The client's transport layer: the only place that calls the API.
 *
 * Nothing here decides what a failure *means* — that is
 * `constant/error-messages.ts`. This turns a response into either data or an
 * `ApiError` carrying a code, and stops there.
 */

/**
 * Classifies a failure whose body is not one of our envelopes.
 *
 * Our API envelopes every error it produces, so an un-enveloped body means the
 * response came from something *between* the client and the API — a dev proxy
 * with nothing to proxy to, a load balancer, a gateway. A 5xx from there is
 * "cannot reach the server", not "the server broke": Vite answers 502 when the
 * API is not running, and calling that an internal error sends people looking
 * for a bug that does not exist.
 *
 * @param status the HTTP status
 * @returns the code to raise
 */
function unenvelopedCode(status: number): string {
  return status >= 500 ? 'NETWORK' : 'INTERNAL';
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
    if (failure.success) {
      const { code, message, details } = failure.data.error;
      throw new ApiError(code, message, details);
    }
    throw new ApiError(unenvelopedCode(res.status), `Request failed (${res.status})`);
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
