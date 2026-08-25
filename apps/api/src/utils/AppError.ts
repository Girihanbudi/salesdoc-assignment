/** One field that failed validation. Keeps the path so the UI can mark it. */
export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * An error with an HTTP status and a machine-readable code.
 *
 * Throwing this anywhere in a request is how a handler or controller reports
 * failure: `error-handler.ts` is the only place that turns it into a response,
 * so no handler ever builds an error body by hand.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[] | undefined;

  /**
   * @param status HTTP status to respond with
   * @param code namespaced machine code, e.g. `SESSION.NOT_FOUND`
   * @param message human-readable explanation
   * @param details per-field failures, when the cause is validation
   */
  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
