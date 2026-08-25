import type { TerminalCallStatus } from '@salesdoc/shared';

/**
 * Mocked outcome distribution. Weights are consumed cumulatively against
 * `random()` and must sum to 1.
 *
 * A domain rule, not deployment configuration — deliberately not env-tunable,
 * because changing it would change behaviour the tests pin.
 */
export const OUTCOME_WEIGHTS: readonly { status: TerminalCallStatus; weight: number }[] = [
  { status: 'CONNECTED', weight: 0.35 },
  { status: 'NO_ANSWER', weight: 0.3 },
  { status: 'VOICEMAIL', weight: 0.2 },
  { status: 'BUSY', weight: 0.15 },
];
