import type { CRMActivity, CRMContact } from '@salesdoc/shared';
import type { AppContext } from '../types/context.js';

/**
 * Lists the mock CRM's contacts.
 *
 * @param ctx the app context
 * @returns a handler resolving to every contact
 */
export const contacts =
  (ctx: AppContext) =>
  (): CRMContact[] =>
    ctx.crm.findAllContacts();

/**
 * Lists the mock CRM's activities.
 *
 * @param ctx the app context
 * @returns a handler resolving to every activity
 */
export const activities =
  (ctx: AppContext) =>
  (): CRMActivity[] =>
    ctx.crm.findAllActivities();
