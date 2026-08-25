import type { Env } from './constant/env.js';
import { createCrmSyncController } from './controllers/crm-sync.controller.js';
import { createDialer } from './controllers/dialer.controller.js';
import { createSessionViewController } from './controllers/session-view.controller.js';
import { createStore, type Store } from './db/store.js';
import { createMockCrmClient } from './mocks/mock-crm.client.js';
import { createActivitiesRepository } from './repositories/activities.repository.js';
import { createAgentsRepository } from './repositories/agents.repository.js';
import { createCallsRepository } from './repositories/calls.repository.js';
import { createCrmRepository } from './repositories/crm.repository.js';
import { createLeadsRepository } from './repositories/leads.repository.js';
import { createSessionsRepository } from './repositories/sessions.repository.js';
import type { AppContext } from './types/context.js';
import { createClock, type Clock } from './utils/clock.js';
import { guarded, type GuardLogger } from './utils/guarded.js';

/** Overrides for tests, which supply their own store and clock. */
export interface ContainerOptions {
  store?: Store;
  clock?: Clock;
  /** Where a failure inside scheduled work is reported. */
  logger?: GuardLogger;
  /**
   * Scheduler for deferred CRM writes. Defaults to `clock`.
   *
   * Separable because call outcomes and CRM writes are independent timelines:
   * tests drain one without advancing the other, so a tick always means
   * exactly one call resolving.
   */
  crmClock?: Clock;
}

/**
 * The composition root — the only place that knows how the pieces connect.
 *
 * Wiring lives here so no module has to import its own collaborators, which is
 * what keeps the layers pointing one way.
 *
 * @param env the validated environment
 * @param options test overrides for the store and clock
 * @returns the context every handler receives
 */
export function createContainer(env: Env, options: ContainerOptions = {}): AppContext {
  const store = options.store ?? createStore();
  const logger = options.logger ?? console;

  // Guarded here rather than at each call site: every scheduled callback in the
  // dialer and the CRM sync runs outside a request, where an uncaught throw
  // would take the process down.
  const clock = guarded(options.clock ?? createClock(), logger);
  const crmClock = guarded(options.crmClock ?? options.clock ?? createClock(), logger);

  const agents = createAgentsRepository(store);
  const leads = createLeadsRepository(store);
  const calls = createCallsRepository(store);
  const sessions = createSessionsRepository(store);
  const activities = createActivitiesRepository(store);
  const crm = createCrmRepository(store);

  const client = createMockCrmClient(crm, clock, {
    latencyMinMs: env.CRM_LATENCY_MIN_MS,
    latencyMaxMs: env.CRM_LATENCY_MAX_MS,
  });

  const crmSync = createCrmSyncController({
    leads,
    activities,
    crm,
    client,
    clock: crmClock,
  });

  const dialer = createDialer({
    sessions,
    calls,
    crmSync,
    clock,
    ring: { minMs: env.RING_MIN_MS, maxMs: env.RING_MAX_MS },
    talk: { minMs: env.TALK_MIN_MS, maxMs: env.TALK_MAX_MS },
  });

  const sessionView = createSessionViewController({ leads, calls, activities, crm });

  return { agents, leads, calls, sessions, activities, crm, dialer, crmSync, sessionView, id: clock.id };
}
