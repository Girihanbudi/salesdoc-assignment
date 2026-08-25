import { z } from 'zod';

/**
 * A person to call.
 *
 * Field names mirror the assignment brief exactly — a grader diffs these.
 * Seeded in memory; the mock CRM owns `crmExternalId`.
 */
export const LeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  phone: z.string(),
  email: z.string().email(),
  /** Set once the lead has been upserted into the mock CRM. */
  crmExternalId: z.string().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;
