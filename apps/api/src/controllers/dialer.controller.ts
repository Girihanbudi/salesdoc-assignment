import {
  CONCURRENCY,
  type Call,
  type DialerSession,
  type Disposition,
  type TerminalCallStatus,
} from '@salesdoc/shared';
import {
  STOPPED_MID_CALL_DISPOSITION,
  STOPPED_MID_CALL_NOTES,
} from '../constant/crm.js';
import { OUTCOME_WEIGHTS } from '../constant/dialer.js';
import type { CallsRepository } from '../repositories/calls.repository.js';
import type { SessionsRepository } from '../repositories/sessions.repository.js';
import type { Clock } from '../utils/clock.js';
import type { CrmSyncController } from './crm-sync.controller.js';

/** How long a mocked call rings before its outcome lands. */
export interface RingWindow {
  minMs: number;
  maxMs: number;
}

/** What {@link createDialer} needs to do its job. */
export interface DialerDeps {
  sessions: SessionsRepository;
  calls: CallsRepository;
  crmSync: CrmSyncController;
  clock: Clock;
  ring: RingWindow;
}

/** Drives every dialer session's lifecycle. */
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
 * Builds the dialer engine — the state machine the whole assignment rests on.
 *
 * Knows nothing about HTTP. Every nondeterministic input arrives through
 * `clock`, which is what lets the tests assert "line 1 connects, line 2 is
 * cancelled" exactly, with no sleeping.
 *
 * @param deps repositories, the clock, CRM sync, and the ring window
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
    let roll = deps.clock.random();
    for (const outcome of OUTCOME_WEIGHTS) {
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
   * call is not finished from the CRM's point of view until the agent has hung
   * up and chosen a disposition, so its sync is deferred to {@link Dialer.endCall}.
   * Syncing on connect would burn the callId idempotency key against a
   * placeholder and silently discard the agent's real disposition.
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
    call.endedAt = deps.clock.now();
    deps.calls.save(call);

    session.activeCallIds = session.activeCallIds.filter((id) => id !== call.id);

    if (status === 'CONNECTED') session.metrics.connected += 1;
    else if (status === 'CANCELED_BY_DIALER') session.metrics.canceled += 1;
    else session.metrics.failed += 1;

    if (status !== 'CONNECTED') deps.crmSync.sync(call);
  }

  /**
   * Resolves a call that rang out, then refills the freed line.
   *
   * @param sessionId the session the call belongs to
   * @param callId the call whose outcome has arrived
   */
  function resolveCall(sessionId: string, callId: string): void {
    const session = deps.sessions.findById(sessionId);
    const call = deps.calls.findById(callId);
    if (!session || !call || call.status !== 'DIALING') return;

    const status = rollOutcome();

    if (status === 'CONNECTED') {
      // First connect claims the agent. Every other live line is dropped —
      // these are the "abandoned calls" a parallel dialer trades away.
      session.winnerCallId = call.id;
      terminate(session, call, 'CONNECTED');

      for (const otherId of [...session.activeCallIds]) {
        const other = deps.calls.findById(otherId);
        if (other && other.status === 'DIALING') {
          terminate(session, other, 'CANCELED_BY_DIALER');
        }
      }
    } else {
      terminate(session, call, status);
    }

    deps.sessions.save(session);
    fillLines(sessionId);
  }

  /**
   * Dials leads until every line is busy, the queue empties, or a call
   * connects. Stops the session once nothing is left to do.
   *
   * @param sessionId the session to top up
   */
  function fillLines(sessionId: string): void {
    const session = deps.sessions.findById(sessionId);
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
        id: `call-${deps.clock.id()}`,
        leadId,
        sessionId,
        status: 'DIALING',
        startedAt: deps.clock.now(),
        endedAt: null,
        providerCallId: `mock_${deps.clock.id()}`,
      };

      deps.calls.save(call);
      session.activeCallIds.push(call.id);
      session.metrics.attempted += 1;

      const ringMs =
        deps.ring.minMs + deps.clock.random() * (deps.ring.maxMs - deps.ring.minMs);
      pending.set(
        call.id,
        deps.clock.schedule(() => resolveCall(sessionId, call.id), ringMs)
      );
    }

    if (
      session.leadQueue.length === 0 &&
      session.activeCallIds.length === 0 &&
      session.winnerCallId === null
    ) {
      session.status = 'STOPPED';
    }

    deps.sessions.save(session);
  }

  return {
    start(sessionId) {
      const session = deps.sessions.findById(sessionId);
      if (!session || session.status === 'RUNNING') return;
      session.status = 'RUNNING';
      deps.sessions.save(session);
      fillLines(sessionId);
    },

    stop(sessionId) {
      const session = deps.sessions.findById(sessionId);
      if (!session) return;

      // Copy: terminate() splices activeCallIds as it goes.
      for (const callId of [...session.activeCallIds]) {
        const call = deps.calls.findById(callId);
        if (call && call.status === 'DIALING') {
          terminate(session, call, 'CANCELED_BY_DIALER');
        }
      }

      // A connected call still holding the agent never reached endCall, so its
      // CRM sync is still owed. Record it rather than losing the conversation.
      const winnerId = session.winnerCallId;
      if (winnerId !== null) {
        const winner = deps.calls.findById(winnerId);
        if (winner) {
          deps.crmSync.sync(winner, {
            disposition: STOPPED_MID_CALL_DISPOSITION,
            notes: STOPPED_MID_CALL_NOTES,
          });
        }
      }

      session.winnerCallId = null;
      session.status = 'STOPPED';
      deps.sessions.save(session);
    },

    endCall(sessionId, callId, outcome) {
      const session = deps.sessions.findById(sessionId);
      const call = deps.calls.findById(callId);
      if (!session || !call || session.winnerCallId !== callId) return;

      // The call already reached CONNECTED when it was answered. Its CRM sync
      // was deliberately deferred to here, where the agent's disposition exists.
      deps.crmSync.sync(call, outcome);
      session.winnerCallId = null;
      deps.sessions.save(session);

      fillLines(sessionId);
    },
  };
}
