import type { CRMActivity, Lead } from '@salesdoc/shared';
import type { AppContext } from '../types/context.js';
import { withLead } from '../utils/with-entity.js';

/**
 * Lists every seeded lead.
 *
 * @param ctx the app context
 * @returns a handler resolving to the leads
 */
export const list =
  (ctx: AppContext) =>
  (): Lead[] =>
    ctx.leads.findAll();

/**
 * Lists our own CRM activities for one lead.
 *
 * @param ctx the app context
 * @returns a handler resolving to the lead's activities
 */
export const crmActivities = (ctx: AppContext) =>
  withLead<{ params: { id: string } }, CRMActivity[]>(ctx, (leadId) =>
    ctx.activities.findByLeadId(leadId)
  );
