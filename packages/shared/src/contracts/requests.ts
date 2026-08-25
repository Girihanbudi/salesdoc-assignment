import { z } from 'zod';
import { DispositionSchema } from '../models/disposition.js';

/**
 * Body of `POST /api/sessions`.
 *
 * Declared on the route, so it runs before any handler. Anything that needs
 * the database — do these leads exist? — is a business rule and lives in a
 * controller instead.
 */
export const CreateSessionBodySchema = z.object({
  agentId: z.string().min(1).default('agent-1'),
  leadIds: z.array(z.string()).min(1, 'Select at least one lead'),
});
export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;

/** Body of `POST /api/sessions/:id/calls/:callId/end`. */
export const EndCallBodySchema = z.object({
  disposition: DispositionSchema,
  notes: z.string().max(2000).default(''),
});
export type EndCallBody = z.infer<typeof EndCallBodySchema>;
