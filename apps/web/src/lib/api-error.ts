import type { ErrorDetail } from '@salesdoc/shared';

/**
 * Thrown for any non-2xx response, carrying the API's machine-readable code.
 *
 * The `message` is the server's own wording and is for logs, not for display —
 * `toUserMessage` decides what a person sees.
 */
export class ApiError extends Error {
  readonly code: string;
  /** Per-field validation failures, when the cause was a bad request. */
  readonly details: ErrorDetail[] | undefined;

  /**
   * @param code the API's error code, e.g. `SESSION.NOT_FOUND`
   * @param message the server's own wording, for logs
   * @param details per-field validation failures, when there were any
   */
  constructor(code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}
