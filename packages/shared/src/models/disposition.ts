import { z } from 'zod';

/**
 * Outcome recorded against a call.
 *
 * Every value here is derived from how the call ended — the brief asks for
 * "disposition + basic notes" written automatically when a call reaches a
 * terminal outcome, not chosen by a person.
 *
 * `INTERESTED` / `NOT_INTERESTED` / `CALLBACK` are unreachable today. They are
 * kept because they are the vocabulary an agent wrap-up screen would use, and
 * NOTES.md names that as the next step; a future flow should not have to widen
 * a shipped enum.
 */
export const DispositionSchema = z.enum([
  /** Spoke to the lead. What was said is not captured without an agent flow. */
  'CONNECTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'CALLBACK',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'CANCELED',
]);
export type Disposition = z.infer<typeof DispositionSchema>;
