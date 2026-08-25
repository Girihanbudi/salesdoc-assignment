import { z } from 'zod';
import { CallSchema } from '../models/call.js';
import { CRMActivitySchema, CrmSyncStatusSchema } from '../models/crm-activity.js';
import { LeadSchema } from '../models/lead.js';
import { DialerSessionSchema } from '../models/session.js';

/**
 * Read models — shapes the API composes for a screen, not things it stores.
 *
 * Kept apart from `models/` because they exist to serve a view: they can be
 * reshaped whenever the UI needs, while the models mirror the brief and cannot.
 */

/** One dialer line, hydrated with everything the UI needs to render a card. */
export const LineViewSchema = z.object({
  call: CallSchema,
  lead: LeadSchema,
  crmSyncStatus: CrmSyncStatusSchema.nullable(),
});
export type LineView = z.infer<typeof LineViewSchema>;

/**
 * The single payload the dashboard polls. Fully hydrated so the client never
 * joins calls to leads itself.
 */
export const SessionViewSchema = z.object({
  session: DialerSessionSchema,
  /** Active lines, up to the session's concurrency. */
  lines: z.array(LineViewSchema),
  /** The connected call holding the agent, if any. */
  winner: LineViewSchema.nullable(),
  /** Every call in this session, newest first. */
  history: z.array(LineViewSchema),
  /** Leads not yet dialed, in order. */
  upNext: z.array(LeadSchema),
  activities: z.array(CRMActivitySchema),
});
export type SessionView = z.infer<typeof SessionViewSchema>;

/**
 * A session plus everything that happened in it.
 *
 * Distinct from {@link SessionViewSchema}: that one is tuned for a live
 * dashboard, this one is the after-the-fact log.
 */
export const SessionDetailSchema = z.object({
  session: DialerSessionSchema,
  /** Every call placed, newest first, hydrated with its lead. */
  calls: z.array(LineViewSchema),
  activities: z.array(CRMActivitySchema),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

/**
 * One CRM activity with everything needed to render it on its own page.
 *
 * The activity alone carries only ids; a detail view needs the lead it
 * concerns and the call that produced it.
 */
export const ActivityDetailSchema = z.object({
  activity: CRMActivitySchema,
  lead: LeadSchema,
  /** Null when the call has been lost to a restart. */
  call: CallSchema.nullable(),
});
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;
