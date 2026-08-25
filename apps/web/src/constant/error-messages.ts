import { ApiError } from '@/lib/api-error.js';
import type { UserMessage } from '@/types/user-message.js';
import { ACTIVITY_MESSAGES } from './messages/activity.messages.js';
import { AGENT_MESSAGES } from './messages/agent.messages.js';
import { CALL_MESSAGES } from './messages/call.messages.js';
import { FALLBACK_MESSAGE, GENERIC_MESSAGES } from './messages/generic.messages.js';
import { LEAD_MESSAGES } from './messages/lead.messages.js';
import { SESSION_MESSAGES } from './messages/session.messages.js';

/**
 * Every code the API can return, mapped to something a person can act on.
 *
 * Split by resource so the files stay small and, more usefully, so they mirror
 * `ERR` in the API one-for-one: adding `ERR.LEAD.X` on the server tells you
 * exactly which file to open here. This composes them rather than re-exporting
 * them, so it is not one of the barrel files CLAUDE.md bans.
 *
 * Codes are the contract; this wording is not, and can change freely.
 */
const MESSAGES: Record<string, UserMessage> = {
  ...GENERIC_MESSAGES,
  ...LEAD_MESSAGES,
  ...SESSION_MESSAGES,
  ...CALL_MESSAGES,
  ...AGENT_MESSAGES,
  ...ACTIVITY_MESSAGES,
};

/**
 * Turns anything thrown into a message worth showing.
 *
 * An unmapped code falls back to a generic apology rather than leaking a raw
 * server string — but the code is appended, because a user quoting "INTERNAL"
 * is far more use in a bug report than one quoting "Failed to fetch".
 *
 * @param cause whatever was thrown
 * @param fallbackTitle context-specific wording, e.g. 'Could not start the session'
 * @returns the title and detail to display
 */
export function toUserMessage(cause: unknown, fallbackTitle?: string): UserMessage {
  if (!(cause instanceof ApiError)) {
    return { ...FALLBACK_MESSAGE, title: fallbackTitle ?? FALLBACK_MESSAGE.title };
  }

  const known = MESSAGES[cause.code];
  if (!known) {
    return {
      title: fallbackTitle ?? FALLBACK_MESSAGE.title,
      detail: `Unexpected error (${cause.code}).`,
    };
  }

  // A validation failure names the offending fields, which beats any wording
  // written in advance.
  if (cause.code === 'VALIDATION_FAILED' && cause.details && cause.details.length > 0) {
    const fields = cause.details
      .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
      .join('; ');
    return { title: known.title, detail: fields };
  }

  return known;
}
