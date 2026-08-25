import type { CallStatus, Disposition } from '@salesdoc/shared';

/**
 * Disposition recorded for an outcome the agent never handled.
 *
 * Keyed by every terminal status except CONNECTED, which always carries the
 * agent's own disposition and so never falls back to this table.
 */
export const AUTO_DISPOSITION: Partial<Record<CallStatus, Disposition>> = {
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  VOICEMAIL: 'VOICEMAIL',
  CANCELED_BY_DIALER: 'CANCELED',
};

/** Note recorded for an outcome the agent never handled. */
export const AUTO_NOTES: Partial<Record<CallStatus, string>> = {
  NO_ANSWER: 'No answer. Line rang out with no pickup.',
  BUSY: 'Busy signal. Line engaged.',
  VOICEMAIL: 'Reached voicemail. No message left.',
  CANCELED_BY_DIALER: 'Canceled by dialer — another line on this session connected first.',
};

/** Disposition used when a session is stopped mid-conversation. */
export const STOPPED_MID_CALL_DISPOSITION: Disposition = 'CALLBACK';

/** Note used when a session is stopped mid-conversation. */
export const STOPPED_MID_CALL_NOTES =
  'Session stopped while the call was connected; no disposition recorded.';
