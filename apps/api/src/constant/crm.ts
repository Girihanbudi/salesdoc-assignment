import type { CallStatus, Disposition } from '@salesdoc/shared';

/**
 * Disposition written for each terminal outcome.
 *
 * Every terminal status has an entry, CONNECTED included. There is no agent
 * wrap-up screen, so nothing supplies a disposition by hand and a gap here
 * would silently record the wrong outcome.
 */
export const AUTO_DISPOSITION: Record<Exclude<CallStatus, 'DIALING'>, Disposition> = {
  CONNECTED: 'CONNECTED',
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  VOICEMAIL: 'VOICEMAIL',
  CANCELED_BY_DIALER: 'CANCELED',
};

/** The "basic notes" the brief asks for, one per terminal outcome. */
export const AUTO_NOTES: Record<Exclude<CallStatus, 'DIALING'>, string> = {
  CONNECTED: 'Spoke with the lead. Conversation content is not captured.',
  NO_ANSWER: 'No answer. Line rang out with no pickup.',
  BUSY: 'Busy signal. Line engaged.',
  VOICEMAIL: 'Reached voicemail. No message left.',
  CANCELED_BY_DIALER: 'Canceled by dialer — another line on this session connected first.',
};

/** Note written when a session is stopped while a call was still connected. */
export const STOPPED_MID_CALL_NOTES =
  'Session stopped while the call was connected; the conversation was cut short.';
