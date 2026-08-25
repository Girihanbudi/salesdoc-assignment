import {
  CONCURRENCY,
  type Call,
  type DialerSession,
  type TerminalCallStatus,
} from '@salesdoc/shared';
import { STOPPED_MID_CALL_NOTES } from '../constant/crm.js';
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

/** How long a mocked conversation lasts once the lead answers. */
export interface TalkWindow {
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
  talk: TalkWindow;
}

/** Drives every dialer session's lifecycle. */
export interface Dialer {
  /** Begins dialing. Idempotent — starting a RUNNING session does nothing. */
  start: (sessionId: string) => void;
  /** Cancels every active call and halts the session. */
  stop: (sessionId: string) => void;
  /** Hangs up the connected call early, instead of letting it run out. */
  endCall: (sessionId: string, callId: string) => void;
}

/**
 * Builds the dialer engine — the state machine the whole assignment rests on.
 *
 * Knows nothing about HTTP. Every nondeterministic input arrives through
 * `clock`, which is what lets the tests assert "line 1 connects, line 2 is
 * cancelled" exactly, with no sleeping.
 *
 * @param deps repositories, the clock, CRM sync, and the timing windows
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
   * Ends a call that never reached a conversation, and frees its line.
   *
   * Only for outcomes that finish the instant they are decided. A CONNECTED
   * call does not come through here — somebody is talking, so it keeps its
   * line until {@link endConversation}.
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

    deps.crmSync.sync(call);
  }

  /**
   * Ends the conversation on the winning call.
   *
   * A connected call is the one outcome that does not finish the moment it is
   * decided — somebody is talking. It holds its line until the mocked
   * conversation runs out, and only then does it end, sync, and free the agent.
   * Stamping `endedAt` at the moment of answer would record every conversation
   * as zero seconds long.
   *
   * @param sessionId the session holding the call
   * @param callId the connected call
   * @param notesOverride replaces the derived note when the call was cut short
   */
  function endConversation(
    sessionId: string,
    callId: string,
    notesOverride?: string
  ): void {
    const session = deps.sessions.findById(sessionId);
    const call = deps.calls.findById(callId);
    if (!session || !call || call.endedAt !== null) return;

    pending.get(call.id)?.();
    pending.delete(call.id);

    call.endedAt = deps.clock.now();
    deps.calls.save(call);

    session.activeCallIds = session.activeCallIds.filter((id) => id !== call.id);
    if (session.winnerCallId === call.id) session.winnerCallId = null;
    deps.sessions.save(session);

    deps.crmSync.sync(call, notesOverride);
    fillLines(sessionId);
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

      call.status = 'CONNECTED';
      deps.calls.save(call);
      session.metrics.connected += 1;

      // Deliberately NOT terminate(): the call keeps its line and stays
      // unended while the conversation runs, so the UI can show which line is
      // live and the recorded duration is talk time rather than ring time.
      for (const otherId of [...session.activeCallIds]) {
        const other = deps.calls.findById(otherId);
        if (other && other.status === 'DIALING') {
          terminate(session, other, 'CANCELED_BY_DIALER');
        }
      }

      const talkMs =
        deps.talk.minMs + deps.clock.random() * (deps.talk.maxMs - deps.talk.minMs);
      pending.set(
        call.id,
        deps.clock.schedule(() => {
          endConversation(sessionId, call.id);
        }, talkMs)
      );
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

      // Marked STOPPED first, because ending the conversation below runs
      // fillLines() — and a session being stopped must not dial two more leads
      // on its way out. fillLines() returns immediately once status is not
      // RUNNING.
      session.status = 'STOPPED';
      deps.sessions.save(session);

      // Copy: terminate() splices activeCallIds as it goes.
      for (const callId of [...session.activeCallIds]) {
        const call = deps.calls.findById(callId);
        if (call && call.status === 'DIALING') {
          terminate(session, call, 'CANCELED_BY_DIALER');
        }
      }

      // A conversation still running is cut short rather than left unrecorded:
      // the call happened, so the CRM should say so.
      const winnerId = session.winnerCallId;
      if (winnerId !== null) {
        endConversation(sessionId, winnerId, STOPPED_MID_CALL_NOTES);
      }

      const stopped = deps.sessions.findById(sessionId);
      if (!stopped) return;
      stopped.winnerCallId = null;
      deps.sessions.save(stopped);
    },

    endCall(sessionId, callId) {
      // Hanging up early. The mocked conversation would have ended on its own;
      // this just brings that forward, and the CRM write is identical either
      // way because the disposition is derived from the call, not chosen.
      endConversation(sessionId, callId);
    },
  };
}
