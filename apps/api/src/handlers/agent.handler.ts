import type { Agent } from '@salesdoc/shared';
import type { AppContext } from '../types/context.js';

/**
 * The agent the UI is running as.
 *
 * @param ctx the app context
 * @returns a handler resolving to the current agent
 */
export const current =
  (ctx: AppContext) =>
  (): Agent =>
    ctx.agents.findCurrent();
