import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ERR } from '../constant/error-codes.js';
import { AppError, type ErrorDetail } from '../utils/AppError.js';

/** Fastify's own validation shape, used when a route schema rejects a body. */
interface FastifyValidationIssue {
  instancePath?: string;
  params?: { issue?: { path?: (string | number)[] } };
  message?: string;
}

/**
 * Extracts per-field details from whatever a validation failure arrived as.
 *
 * Route-schema failures reach here in three shapes depending on where zod ran:
 * a bare `ZodError`, one wrapped as `error.cause`, or Fastify's own
 * `error.validation` array. Keeping the field path matters — a bare string
 * loses which input the user has to fix.
 *
 * @param error the thrown value
 * @returns the details, or null when this was not a validation failure
 */
function toValidationDetails(error: unknown): ErrorDetail[] | null {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof ZodError) {
    return cause.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }

  const validation = (error as { validation?: FastifyValidationIssue[] }).validation;
  if (Array.isArray(validation)) {
    return validation.map((issue) => ({
      path:
        issue.params?.issue?.path?.join('.') ??
        issue.instancePath?.replace(/^\//, '').replace(/\//g, '.') ??
        '',
      message: issue.message ?? 'Invalid value',
    }));
  }

  return null;
}

/**
 * Turns a thrown error into the one response envelope.
 *
 * This is the only place in the codebase that builds an error body, which is
 * why no handler needs to. Anything unrecognised becomes a 500 with a generic
 * message — an internal failure must never leak a stack trace to a client.
 *
 * @param app the Fastify instance to install the handler on
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    const details = toValidationDetails(error);
    if (details) {
      return reply.code(400).send({
        error: { code: ERR.VALIDATION_FAILED, message: 'Request validation failed', details },
      });
    }

    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply.code(500).send({
        error: { code: ERR.INTERNAL, message: 'Internal server error' },
      });
    }

    const message = error instanceof Error ? error.message : 'Request failed';
    return reply.code(status).send({
      error: { code: ERR.VALIDATION_FAILED, message },
    });
  });
}
