import {
  CONCURRENCY,
  type Call,
  type Disposition,
  type DialerSession,
  type TerminalCallStatus,
} from '@salesdoc/shared';
import { syncToCrm, type CrmDeps } from './crm.js';
import type { Store } from './store.js';

/**
 * Injected seams. Every source of nondeterminism in the engine goes through
 * one of these so tests can drive the machine with a fake clock, a seeded
 * random, and a manual timer queue.
 */
export interface DialerDeps {
  store: Store;
  now: () => string;
  id: () => string;
  random: () => number;
  /** Returns a cancel function so a losing line's pending outcome can be dropped. */
  schedule: (fn: () => void, ms: number) => () => void;
  crm: CrmDeps;
}

/**
 * Mocked outcome distribution. Weights are cumulative over `random()`.
 *
 * There is no telephony in this project — the brief asks for mocked calls —
 * so this stands in for what a provider would report.
 */
const OUTCOMES: readonly { status: TerminalCallStatus; weight: number }[] = [
  { status: 'CONNECTED', weight: 0.35 },
  { status: 'NO_ANSWER', weight: 0.3 },
  { status: 'VOICEMAIL', weight: 0.2 },
  { status: 'BUSY', weight: 0.15 },
];

const RING_MIN_MS = 2000;
const RING_MAX_MS = 6000;

/** Drives one dialer session's lifecycle. */
export interface Dialer {
  /** Begins dialing. Idempotent — starting a RUNNING session does nothing. */
  start: (sessionId: string) => void;
  /** Cancels every active call and halts the session. */
  stop: (sessionId: string) => void;
  /** Wraps up the connected call so its line can be reused. */
  endCall: (
    sessionId: string,
    callId: string,
    outcome: { disposition: Disposition; notes: string }
  ) => void;
}

/**
 * Creates the dialer engine.
 *
 * @param deps injected store, clock, randomness, scheduler, and CRM
 * @returns the engine's public operations
 */
export function createDialer(deps: DialerDeps): Dialer {
  /** Pending outcome cancellers, keyed by callId. */
  const pending = new Map<string, () => void>();

  /**
   * Picks a terminal outcome from the weighted distribution.
   *
   * @returns the status the call will land on
   */
  function rollOutcome(): TerminalCallStatus {
    let roll = deps.random();
    for (const outcome of OUTCOMES) {
      if (roll < outcome.weight) return outcome.status;
      roll -= outcome.weight;
    }
    // Floating-point drift can leave a sliver above the summed weights.
    return 'NO_ANSWER';
  }

  /**
   * Applies a terminal status to a call, updates metrics, and frees its line.
   *
   * CRM sync happens here for every outcome *except* CONNECTED. A connected
   * call is not finished from the CRM's point of view until the agent has
   * hung up and chosen a disposition, so its sync is deferred to
   * {@link Dialer.endCall}. Syncing on connect would burn the callId
   * idempotency key against a placeholder disposition and silently discard
   * the agent's real one.
   *
   * @param session the owning session
   * @param call the call to terminate
   * @param status the terminal status to record
   */
  function terminate(
    session: DialerSession,
    call: Call,
    status: TerminalCallStatus
  ): void {
    pending.get(call.id)?.();
    pending.delete(call.id);

    call.status = status;
    call.endedAt = deps.now();
    deps.store.calls.set(call.id, call);

    session.activeCallIds = session.activeCallIds.filter((id) => id !== call.id);

    if (status === 'CONNECTED') session.metrics.connected += 1;
    else if (status === 'CANCELED_BY_DIALER') session.metrics.canceled += 1;
    else session.metrics.failed += 1;

    if (status !== 'CONNECTED') syncToCrm(deps.crm, call);
  }

  /**
   * Resolves a call that rang out, then refills the freed line.
   *
   * @param sessionId the session the call belongs to
   * @param callId the call whose outcome has arrived
   */
  function resolveCall(sessionId: string, callId: string): void {
    const session = deps.store.sessions.get(sessionId);
    const call = deps.store.calls.get(callId);
    if (!session || !call || call.status !== 'DIALING') return;

    const status = rollOutcome();

    if (status === 'CONNECTED') {
      // First connect claims the agent. Every other live line is dropped —
      // these are the "abandoned calls" a parallel dialer trades away.
      session.winnerCallId = call.id;
      terminate(session, call, 'CONNECTED');

      for (const otherId of [...session.activeCallIds]) {
        const other = deps.store.calls.get(otherId);
        if (other && other.status === 'DIALING') {
          terminate(session, other, 'CANCELED_BY_DIALER');
        }
      }
    } else {
      terminate(session, call, status);
    }

    deps.store.sessions.set(sessionId, session);
    fillLines(sessionId);
  }

  /**
   * Dials leads until every line is busy, the queue empties, or a call
   * connects. Stops the session once nothing is left to do.
   *
   * @param sessionId the session to top up
   */
  function fillLines(sessionId: string): void {
    const session = deps.store.sessions.get(sessionId);
    if (!session || session.status !== 'RUNNING') return;

    // While a winner holds the agent, the queue waits — dialing more would
    // just abandon whoever answered next.
    while (
      session.winnerCallId === null &&
      session.activeCallIds.length < CONCURRENCY &&
      session.leadQueue.length > 0
    ) {
      const leadId = session.leadQueue.shift();
      if (leadId === undefined) break;

      const call: Call = {
        id: `call-${deps.id()}`,
        leadId,
        sessionId,
        status: 'DIALING',
        startedAt: deps.now(),
        endedAt: null,
        providerCallId: `mock_${deps.id()}`,
      };

      deps.store.calls.set(call.id, call);
      session.activeCallIds.push(call.id);
      session.metrics.attempted += 1;

      const ringMs = RING_MIN_MS + deps.random() * (RING_MAX_MS - RING_MIN_MS);
      pending.set(
        call.id,
        deps.schedule(() => resolveCall(sessionId, call.id), ringMs)
      );
    }

    if (
      session.leadQueue.length === 0 &&
      session.activeCallIds.length === 0 &&
      session.winnerCallId === null
    ) {
      session.status = 'STOPPED';
    }

    deps.store.sessions.set(sessionId, session);
  }

  return {
    start(sessionId) {
      const session = deps.store.sessions.get(sessionId);
      if (!session || session.status === 'RUNNING') return;
      session.status = 'RUNNING';
      deps.store.sessions.set(sessionId, session);
      fillLines(sessionId);
    },

    stop(sessionId) {
      const session = deps.store.sessions.get(sessionId);
      if (!session) return;

      // Copy: terminate() splices activeCallIds as it goes.
      for (const callId of [...session.activeCallIds]) {
        const call = deps.store.calls.get(callId);
        if (call && call.status === 'DIALING') {
          terminate(session, call, 'CANCELED_BY_DIALER');
        }
      }

      // A connected call still holding the agent never reached endCall, so its
      // CRM sync is still owed. Record it rather than losing the conversation.
      const winnerId = session.winnerCallId;
      if (winnerId !== null) {
        const winner = deps.store.calls.get(winnerId);
        if (winner) {
          syncToCrm(deps.crm, winner, {
            disposition: 'CALLBACK',
            notes: 'Session stopped while the call was connected; no disposition recorded.',
          });
        }
      }

      session.winnerCallId = null;
      session.status = 'STOPPED';
      deps.store.sessions.set(sessionId, session);
    },

    endCall(sessionId, callId, outcome) {
      const session = deps.store.sessions.get(sessionId);
      const call = deps.store.calls.get(callId);
      if (!session || !call || session.winnerCallId !== callId) return;

      // The call already reached CONNECTED when it was answered. Its CRM sync
      // was deliberately deferred to here, where the agent's disposition exists.
      syncToCrm(deps.crm, call, outcome);
      session.winnerCallId = null;
      deps.store.sessions.set(sessionId, session);

      fillLines(sessionId);
    },
  };
}
