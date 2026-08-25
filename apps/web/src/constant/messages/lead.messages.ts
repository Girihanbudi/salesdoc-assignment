import type { UserMessage } from '@/types/user-message.js';

/** Mirrors `ERR.LEAD` in the API. */
export const LEAD_MESSAGES: Record<string, UserMessage> = {
  'LEAD.UNKNOWN': {
    title: 'One of those leads no longer exists',
    detail: 'Refresh the list and try again.',
  },
  'LEAD.NOT_FOUND': {
    title: 'That lead no longer exists',
    detail: 'Refresh the list and try again.',
  },
};
