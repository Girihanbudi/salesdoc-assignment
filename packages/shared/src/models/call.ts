import { z } from 'zod';
import { CallStatusSchema } from './call-status.js';

/** One dial attempt against one lead, within one session. */
export const CallSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  sessionId: z.string(),
  status: CallStatusSchema,
  startedAt: z.string().datetime(),
  /** Null until the call reaches a terminal status. */
  endedAt: z.string().datetime().nullable(),
  /** Stands in for the telephony provider's id. Mocked as `mock_<id>`. */
  providerCallId: z.string(),
});
export type Call = z.infer<typeof CallSchema>;
