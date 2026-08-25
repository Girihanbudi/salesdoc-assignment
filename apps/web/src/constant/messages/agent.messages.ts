import type { UserMessage } from '@/types/user-message.js';

/** Mirrors `ERR.AGENT` in the API. */
export const AGENT_MESSAGES: Record<string, UserMessage> = {
  'AGENT.BUSY': {
    title: 'You already have a session running',
    detail: 'Finish or stop it before starting another.',
  },
};
