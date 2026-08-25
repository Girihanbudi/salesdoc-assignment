import { z } from 'zod';

/**
 * Concurrency is fixed at 2 by the assignment brief. It is stored on the
 * session as a field (rather than being a bare constant) because the brief
 * lists it as part of the DialerSession model.
 */
export const CONCURRENCY = 2;

// ---------------------------------------------------------------------------
// Call status
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Models — field names mirror the assignment brief exactly. Do not rename.
// ---------------------------------------------------------------------------

/** A person to call. Seeded in memory; the mock CRM owns `crmExternalId`. */
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

/** Running totals for a session. Every dial increments `attempted`. */
export const SessionMetricsSchema = z.object({
  attempted: z.number().int().nonnegative(),
  /** CONNECTED */
  connected: z.number().int().nonnegative(),
  /** NO_ANSWER | BUSY | VOICEMAIL */
  failed: z.number().int().nonnegative(),
  /** CANCELED_BY_DIALER */
  canceled: z.number().int().nonnegative(),
});
export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;

/** One agent working a queue of leads across {@link CONCURRENCY} lines. */
export const DialerSessionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  /** Lead ids not yet dialed, in order. */
  leadQueue: z.array(z.string()),
  concurrency: z.literal(CONCURRENCY),
  /** At most {@link CONCURRENCY} entries. Enforced by the dialer engine. */
  activeCallIds: z.array(z.string()).max(CONCURRENCY),
  /** The first call to CONNECT. Null until one does, and after wrap-up. */
  winnerCallId: z.string().nullable(),
  status: z.enum(['RUNNING', 'STOPPED']),
  metrics: SessionMetricsSchema,
});
export type DialerSession = z.infer<typeof DialerSessionSchema>;

/** Outcome recorded against a call. Agent-chosen for a connected call. */
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

/** Our own record of what was written to the CRM. Mirrors the CRM's activity. */
export const CRMActivitySchema = z.object({
  id: z.string(),
  leadId: z.string(),
  crmExternalId: z.string(),
  type: z.literal('CALL'),
  callId: z.string(),
  disposition: DispositionSchema,
  notes: z.string(),
  createdAt: z.string().datetime(),
});
export type CRMActivity = z.infer<typeof CRMActivitySchema>;

/** Whether a call's CRM write has landed. Surfaced per-line in the UI. */
export const CrmSyncStatusSchema = z.enum(['pending', 'synced', 'failed']);
export type CrmSyncStatus = z.infer<typeof CrmSyncStatusSchema>;

// ---------------------------------------------------------------------------
// Mock CRM — stands in for an external system
// ---------------------------------------------------------------------------

/** A contact in the mock CRM. `id` is what a lead stores as `crmExternalId`. */
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

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Body of `POST /api/sessions`. */
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

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** One dialer line, hydrated with everything the UI needs to render a card. */
export const LineViewSchema = z.object({
  call: CallSchema,
  lead: LeadSchema,
  crmSyncStatus: CrmSyncStatusSchema.nullable(),
});
export type LineView = z.infer<typeof LineViewSchema>;

/**
 * The single payload the frontend polls. Fully hydrated so the client never
 * joins calls to leads itself.
 */
export const SessionViewSchema = z.object({
  session: DialerSessionSchema,
  /** Active lines, up to {@link CONCURRENCY}. */
  lines: z.array(LineViewSchema),
  /** The connected call holding the agent, if any. */
  winner: LineViewSchema.nullable(),
  /** Every call in this session, newest first — drives the attempt timeline. */
  history: z.array(LineViewSchema),
  /** Leads not yet dialed, in order. */
  upNext: z.array(LeadSchema),
  activities: z.array(CRMActivitySchema),
});
export type SessionView = z.infer<typeof SessionViewSchema>;

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

/** A session plus everything that happened in it. */
export const SessionDetailSchema = z.object({
  session: DialerSessionSchema,
  /** Every call placed, newest first, hydrated with its lead. */
  calls: z.array(LineViewSchema),
  activities: z.array(CRMActivitySchema),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

/** The one error envelope for the whole API. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
