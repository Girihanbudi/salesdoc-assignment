/**
 * The package's public API.
 *
 * This is a package entry point, not one of the barrel files CLAUDE.md bans:
 * `@salesdoc/shared` is consumed across workspace boundaries and needs one
 * declared surface. Inside a workspace, import the module you need directly.
 *
 * Layout:
 *   models/    — the domain. Field names mirror the assignment brief 1:1
 *                and must not be reshaped for a screen's convenience.
 *   contracts/ — the wire: request bodies, read models, response envelope.
 *                Free to change as the UI needs.
 */

// Domain
export * from './models/agent.js';
export * from './models/call-status.js';
export * from './models/call.js';
export * from './models/crm-activity.js';
export * from './models/crm-contact.js';
export * from './models/disposition.js';
export * from './models/lead.js';
export * from './models/session.js';

// Wire
export * from './contracts/envelope.js';
export * from './contracts/requests.js';
export * from './contracts/views.js';
