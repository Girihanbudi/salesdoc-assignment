import type { Lead } from '@salesdoc/shared';

/**
 * Six leads, as the brief allows 4-8.
 *
 * Four deliberately have no `crmExternalId` and two do, so the "create the
 * contact before the activity" branch is exercised on the very first run and is
 * visible in the demo rather than only in a test.
 */
export const SEED_LEADS: readonly Lead[] = [
  {
    id: 'lead-1',
    name: 'Amara Osei',
    company: 'Northwind Logistics',
    phone: '+1 415 555 0142',
    email: 'amara.osei@northwind-logistics.com',
  },
  {
    id: 'lead-2',
    name: 'Rafael Moreno',
    company: 'Cobalt Health',
    phone: '+1 415 555 0177',
    email: 'r.moreno@cobalthealth.io',
    crmExternalId: 'crm-contact-88213',
  },
  {
    id: 'lead-3',
    name: 'Priya Raghunathan',
    company: 'Meridian Textiles',
    phone: '+65 6555 0193',
    email: 'priya.r@meridiantextiles.sg',
  },
  {
    id: 'lead-4',
    name: 'Tomas Lindqvist',
    company: 'Arboreal Energy',
    phone: '+46 8 555 0116',
    email: 'tomas@arboreal.energy',
  },
  {
    id: 'lead-5',
    name: 'Chen Wei',
    company: 'Lantern Robotics',
    phone: '+1 206 555 0158',
    email: 'chen.wei@lanternrobotics.com',
    crmExternalId: 'crm-contact-88214',
  },
  {
    id: 'lead-6',
    name: 'Nadia Haddad',
    company: 'Sable Financial',
    phone: '+971 4 555 0121',
    email: 'n.haddad@sablefinancial.ae',
  },
];
