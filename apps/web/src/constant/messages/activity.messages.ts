import type { UserMessage } from '@/types/user-message.js';

/** Mirrors `ERR.ACTIVITY` in the API. */
export const ACTIVITY_MESSAGES: Record<string, UserMessage> = {
  'ACTIVITY.NOT_FOUND': {
    title: 'No CRM record for that call',
    detail: 'The call may not have finished, or the server has been restarted.',
  },
};
