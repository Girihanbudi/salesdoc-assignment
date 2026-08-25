import { z } from 'zod';
import { DispositionSchema } from './disposition.js';

/** Our own record of what was written to the CRM. Mirrors the CRM's activity. */
export const CRMActivitySchema = z.object({
  id: z.string(),
  leadId: z.string(),
  crmExternalId: z.string(),
  type: z.literal('CALL'),
  /** The idempotency key: one activity per call, ever. */
  callId: z.string(),
  disposition: DispositionSchema,
  notes: z.string(),
  createdAt: z.string().datetime(),
});
export type CRMActivity = z.infer<typeof CRMActivitySchema>;

/** Whether a call's CRM write has landed. Surfaced per-line in the UI. */
export const CrmSyncStatusSchema = z.enum(['pending', 'synced', 'failed']);
export type CrmSyncStatus = z.infer<typeof CrmSyncStatusSchema>;
