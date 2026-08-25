import type { UserMessage } from '@/types/user-message.js';

/** Mirrors `ERR.CALL` in the API. */
export const CALL_MESSAGES: Record<string, UserMessage> = {
  'CALL.NOT_ACTIVE': {
    title: 'That call is no longer on the line',
    detail: 'It ended before the request reached the server.',
  },
};
