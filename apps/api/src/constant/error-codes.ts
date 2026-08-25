/**
 * Machine-readable error codes, namespaced by the resource they concern.
 *
 * Clients branch on these; the human message beside them may be reworded
 * freely, but a code is a contract and changing one is a breaking change.
 */
export const ERR = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL: 'INTERNAL',
  NOT_FOUND: 'NOT_FOUND',

  LEAD: {
    NOT_FOUND: 'LEAD.NOT_FOUND',
    UNKNOWN: 'LEAD.UNKNOWN',
  },

  SESSION: {
    NOT_FOUND: 'SESSION.NOT_FOUND',
  },

  CALL: {
    NOT_ACTIVE: 'CALL.NOT_ACTIVE',
  },

  ACTIVITY: {
    NOT_FOUND: 'ACTIVITY.NOT_FOUND',
  },

  AGENT: {
    BUSY: 'AGENT.BUSY',
  },
} as const;
