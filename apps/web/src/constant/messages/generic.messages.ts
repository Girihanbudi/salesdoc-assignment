import type { UserMessage } from '@/types/user-message.js';

/**
 * Failures that belong to no particular resource.
 *
 * `NETWORK` is the only code the client raises itself: the server never sees
 * the request, so nothing else can name what happened.
 */
export const GENERIC_MESSAGES: Record<string, UserMessage> = {
  NETWORK: {
    title: 'Cannot reach the server',
    // Covers both "the request never left" and "something between us and the
    // API answered instead" — a dev proxy with a dead backend, a gateway, a
    // cold instance still starting.
    detail: 'The API is not responding. If it is waking from idle this can take ~30s.',
  },
  VALIDATION_FAILED: {
    // Replaced at render time by the offending fields, which say more than
    // anything written in advance.
    title: 'That request was not valid',
  },
  NOT_FOUND: {
    title: 'That page or endpoint does not exist',
  },
  INTERNAL: {
    title: 'Oops — something went wrong on our end',
    detail: 'Nothing you did caused this. Try again in a moment.',
  },
};

/** Shown when the code is missing or unrecognised. */
export const FALLBACK_MESSAGE: UserMessage = {
  title: 'Oops — something went wrong',
  detail: 'Try again in a moment.',
};
