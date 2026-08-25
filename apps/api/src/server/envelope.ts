import type { Meta } from '@salesdoc/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Builds the per-response metadata.
 *
 * @param request the request being answered
 * @returns the meta block
 */
export function metaFor(request: FastifyRequest): Meta {
  return { requestId: request.id, timestamp: new Date().toISOString() };
}

/**
 * Wraps a handler's return value in the success envelope.
 *
 * Registered as a `preSerialization` hook so no handler ever writes the
 * envelope itself — they return domain data and this shapes it.
 *
 * Error bodies are passed through untouched: the error handler has already
 * built a complete envelope, and wrapping it again would nest a failure inside
 * a success.
 *
 * @param request the request being answered
 * @param _reply unused
 * @param payload whatever the handler returned
 * @returns the enveloped payload
 */
export async function envelope(
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: unknown
): Promise<unknown> {
  if (payload !== null && typeof payload === 'object' && 'success' in payload) {
    return payload;
  }
  return { success: true, data: payload, meta: metaFor(request) };
}
