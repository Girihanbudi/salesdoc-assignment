import type { UserMessage } from '@/types/user-message.js';

/** Mirrors `ERR.SESSION` in the API. */
export const SESSION_MESSAGES: Record<string, UserMessage> = {
  'SESSION.NOT_FOUND': {
    title: 'That session no longer exists',
    // Worth saying rather than hiding: sessions live in memory, so a restart
    // or a redeploy takes them with it.
    detail: 'The server restarts clear in-memory state. Start a new session.',
  },
};
