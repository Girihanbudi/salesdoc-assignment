import { z } from 'zod';

/**
 * The five terminal outcomes named in the assignment brief. Reaching any of
 * these ends the call and triggers exactly one CRM sync.
 */
export const TERMINAL_CALL_STATUSES = [
  'CONNECTED',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'CANCELED_BY_DIALER',
] as const;

/**
 * Call status, including the non-terminal `DIALING`.
 *
 * The brief lists only the five terminal values, but a call needs a status
 * between placement and outcome — `DIALING` fills that gap. It is deliberately
 * excluded from {@link TERMINAL_CALL_STATUSES} so it can never trigger a CRM
 * sync. This deviation is documented in NOTES.md.
 */
export const CallStatusSchema = z.enum(['DIALING', ...TERMINAL_CALL_STATUSES]);
export type CallStatus = z.infer<typeof CallStatusSchema>;

/** The subset of {@link CallStatus} that ends a call. */
export const TerminalCallStatusSchema = z.enum(TERMINAL_CALL_STATUSES);
export type TerminalCallStatus = z.infer<typeof TerminalCallStatusSchema>;

/**
 * Narrows a call status to a terminal one.
 *
 * @param status any call status
 * @returns true when the status ends the call and warrants a CRM sync
 */
export function isTerminal(status: CallStatus): status is TerminalCallStatus {
  return status !== 'DIALING';
}
