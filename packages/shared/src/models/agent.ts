import { z } from 'zod';

/**
 * The person working the dialer.
 *
 * Not one of the brief's four models — it exists because "agent-1" is an id,
 * and an id is the wrong thing to greet someone with. There is exactly one
 * seeded agent: this app has no auth, and inventing a login the brief does not
 * ask for would be scope, not realism.
 */
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  /** Shown in the avatar chip when there is no picture. */
  initials: z.string().min(1).max(2),
});
export type Agent = z.infer<typeof AgentSchema>;
