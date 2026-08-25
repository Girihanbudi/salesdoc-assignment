import { z } from 'zod';

/**
 * A contact in the mock CRM.
 *
 * Belongs to the external system, not to us: `id` is what a lead stores as
 * `crmExternalId`.
 */
export const CRMContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  phone: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CRMContact = z.infer<typeof CRMContactSchema>;
