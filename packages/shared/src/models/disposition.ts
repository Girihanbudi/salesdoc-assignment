import { z } from 'zod';

/**
 * Outcome recorded against a call.
 *
 * The first three are agent choices after a real conversation; the rest are
 * derived from a machine outcome the agent never handled.
 */
export const DispositionSchema = z.enum([
  'INTERESTED',
  'NOT_INTERESTED',
  'CALLBACK',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'CANCELED',
]);
export type Disposition = z.infer<typeof DispositionSchema>;
