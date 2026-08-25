import type { CRMActivity, CRMContact, Disposition, Lead } from '@salesdoc/shared';
import type { CrmRepository } from '../repositories/crm.repository.js';
import type { Clock } from '../utils/clock.js';

/** What a contact upsert needs. Deliberately not our `Lead` type. */
export interface ContactUpsert {
  existingId: string | undefined;
  name: string;
  company: string;
  phone: string;
  email: string;
}

/** What an activity write needs. */
export interface ActivityCreate {
  crmExternalId: string;
  leadId: string;
  callId: string;
  disposition: Disposition;
  notes: string;
}

/**
 * Stands in for the external CRM's HTTP API.
 *
 * **This is the swap point.** Replacing the mock with a real vendor means
 * reimplementing this interface and nothing else — the sync controller above it
 * has no idea whether the CRM is a Map or a network call.
 */
export interface MockCrmClient {
  upsertContact: (input: ContactUpsert) => CRMContact;
  createActivity: (input: ActivityCreate, id: string) => CRMActivity;
  /** How long this "request" takes. Real clients would not expose this. */
  latencyMs: () => number;
}

/** Simulated round-trip window, so `pending` is observable in the UI. */
export interface MockCrmOptions {
  latencyMinMs: number;
  latencyMaxMs: number;
}

/**
 * Builds the mock CRM client.
 *
 * @param crm the repository holding the pretend external tables
 * @param clock time, ids, and randomness
 * @param options the simulated latency window
 * @returns a client that behaves like a slow external CRM
 */
export function createMockCrmClient(
  crm: CrmRepository,
  clock: Clock,
  options: MockCrmOptions
): MockCrmClient {
  return {
    upsertContact: (input) => {
      const timestamp = clock.now();

      if (input.existingId !== undefined) {
        const existing = crm.findContact(input.existingId);
        const contact: CRMContact = {
          id: input.existingId,
          name: input.name,
          company: input.company,
          phone: input.phone,
          email: input.email,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        crm.saveContact(contact);
        return contact;
      }

      const contact: CRMContact = {
        id: `crm-contact-${clock.id()}`,
        name: input.name,
        company: input.company,
        phone: input.phone,
        email: input.email,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      crm.saveContact(contact);
      return contact;
    },

    createActivity: (input, id) => {
      const activity: CRMActivity = {
        id: `activity-${id}`,
        leadId: input.leadId,
        crmExternalId: input.crmExternalId,
        type: 'CALL',
        callId: input.callId,
        disposition: input.disposition,
        notes: input.notes,
        createdAt: clock.now(),
      };
      crm.saveActivity(activity);
      return activity;
    },

    // A zero-width range draws no random value, so a test pinning latency
    // keeps its random sequence about call outcomes only.
    latencyMs: () =>
      options.latencyMaxMs === options.latencyMinMs
        ? options.latencyMinMs
        : options.latencyMinMs +
          clock.random() * (options.latencyMaxMs - options.latencyMinMs),
  };
}

/**
 * Maps a lead onto the contact shape the CRM expects.
 *
 * @param lead the lead to mirror
 * @returns the upsert payload
 */
export function contactFromLead(lead: Lead): ContactUpsert {
  return {
    existingId: lead.crmExternalId,
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
  };
}
