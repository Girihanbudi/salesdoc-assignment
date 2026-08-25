# SalesDoc Multi-Line Dialer

A 2-line outbound dialer with a mock CRM. An agent selects leads, starts a
session, and the system dials **two at a time** — the first lead to answer is
the *winner* and takes the agent, the other is hung up. Every call that reaches
a terminal outcome writes exactly one CRM activity.

**Live demo:** _(URL added on deploy)_

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The API runs on `:3000`; Vite proxies to it, so
the browser only ever talks to one origin.

```bash
npm test        # vitest
npm run lint
npm run typecheck
```

## What a multi-line dialer is

Cold outbound connects roughly 5–15% of the time, so an agent dialing one number
at a time spends most of the hour listening to ringing, voicemail, and busy
tones. A **parallel dialer** dials N numbers at once for one agent; the first
person to answer gets connected and the rest are dropped before the agent hears
them.

Call outcomes here are **mocked** — there is no SIP, Twilio, or WebRTC, and the
assignment does not ask for any. The substance is the concurrency-bounded state
machine and the idempotent write-behind to the CRM.

## How it works

```
select leads → create session → START
                                  │
                    ┌─────────────┴─────────────┐
                 line 1                      line 2          (concurrency = 2)
                    │                           │
              random outcome              random outcome
                    │                           │
        ┌───────────┴────────┐                  │
   CONNECTED            NO_ANSWER/BUSY/VOICEMAIL │
        │                    │                  │
   winner claimed ──────────────────────► other line CANCELED_BY_DIALER
        │                    │
   agent talks          line refills from queue
        │
   end call + disposition
        │
        └──► CRM sync (idempotent on callId) ──► contact upsert → activity
```

Every terminal call syncs to the CRM exactly once. The idempotency key is the
`callId`, so a replayed terminal event cannot create a duplicate activity.

## Architecture

### Shape

Three npm workspaces. `shared` is the contract; neither app talks to the other
except through it.

```
packages/shared          zod schemas -> the single source of truth for types
        │                (server validates with them, client infers from them)
        ├──────────────┐
        ▼              ▼
apps/server        apps/web
  index.ts           App.tsx ──── usePoll(1.5s) ──┐
  app.ts   ◄─────────────────────────────────────┘
  dialer.ts   the state machine
  crm.ts      idempotent write-behind
  store.ts    in-memory Maps
```

In production there is **one process on one port**: Fastify serves the API *and*
`apps/web/dist`. Same-origin in dev too (Vite proxies `/api` to `:3000`), so
`fetch('/api/leads')` is identical in both and there is no CORS and no base-URL
env var to get wrong.

### Layers

| Layer | File | Responsibility |
|---|---|---|
| HTTP | `app.ts` | parse → call engine → map to response. No business logic. |
| Engine | `dialer.ts` | the state machine: lines, winner election, retries |
| Integration | `crm.ts` | contact upsert + idempotent activity write |
| Persistence | `store.ts` | in-memory `Map`s, seeded on boot |
| Contract | `shared/schemas.ts` | models + request/response shapes |

`app.ts` is deliberately thin — it never decides anything about calls. That is
why the engine can be tested without HTTP, and the routes tested without timers.

### The one design decision worth knowing

Everything nondeterministic is **injected**, not imported:

```ts
createDialer({ store, now, id, random, schedule, crm })
```

Production passes `Date.now`, `randomUUID`, `Math.random`, and `setTimeout`.
Tests pass a fake clock, a counter, a scripted random sequence, and a manual
timer queue — so "line 1 connects, line 2 is cancelled" is asserted exactly,
with no sleeping and no flake. `schedule` returns a *canceller*, which is what
makes a losing line's pending outcome droppable.

This is the only indirection in the codebase, and it is what makes the tests
able to fail for the right reason.

### Request flow

```
POST /api/sessions      -> validate leadIds, build session (STOPPED)
POST /:id/start         -> fillLines(): dial up to 2, schedule each outcome
   ...outcome fires     -> CONNECTED? claim winner, cancel the other line
                           otherwise: count it, free the line, refill
   ...terminal          -> syncToCrm(): guard on callId, upsert contact,
                           write activity to BOTH stores
GET  /api/sessions/:id  <- one hydrated payload; the client joins nothing
POST /:id/calls/:cid/end-> agent's disposition -> CRM -> resume dialing
```

**A connected call syncs to the CRM at wrap-up, not on answer.** Syncing on
answer would claim the `callId` idempotency key against a placeholder
disposition and silently discard the agent's real one. `stop()` covers the gap
so a conversation is never lost.

### Layout

| Path | What |
|---|---|
| `apps/server/src/dialer.ts` | the state machine — **the interesting file** |
| `apps/server/src/crm.ts` | mock CRM store + idempotent sync |
| `apps/server/src/store.ts` | in-memory `Map`s, seeded on boot |
| `apps/server/src/app.ts` | routes, validation, error envelope |
| `apps/server/src/test-harness.ts` | fake clock/random/timers for the engine |
| `apps/web/src/` | React dashboard, polls every 1.5s |
| `packages/shared/src/schemas.ts` | zod models shared by both sides |

There is no database. State lives in memory and resets on restart — permitted by
the brief, and noted in [NOTES.md](./NOTES.md).

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness |
| `GET` | `/api/leads` | seeded leads |
| `POST` | `/api/sessions` | create from `{ agentId, leadIds[] }` |
| `POST` | `/api/sessions/:id/start` | begin dialing |
| `POST` | `/api/sessions/:id/stop` | cancel active calls |
| `GET` | `/api/sessions/:id` | **the poll endpoint** — fully hydrated view |
| `POST` | `/api/sessions/:id/calls/:callId/end` | wrap up the winner |
| `GET` | `/leads/:id/crm-activities` | our record |
| `GET` | `/mock-crm/contacts` | the mock CRM's contacts |
| `GET` | `/mock-crm/activities` | the mock CRM's activities |

Interactive docs at **`/docs`** (Swagger UI, generated from the zod schemas).

Errors use one envelope: `{ error: { code, message, details? } }`.

## Deployment

One container, one process, one port — Fastify serves the API *and* the built
frontend.

```bash
docker compose up --build        # http://localhost:3000
```

That is the whole demo path if you would rather not install Node. The compose
file defines a single service, because the app is a single process and there is
no database to compose against. It includes a healthcheck on `/api/health`, so
`docker compose ps` reports `healthy` rather than merely `running`. Override the
host port with `PORT=8080 docker compose up`.

Without compose:

```bash
docker build -t dialer .
docker run -p 3000:3000 dialer
```

Hosted on Render's free tier from `render.yaml`. That tier sleeps after ~15
minutes idle, so a cold first request takes ~30–50s and in-memory state resets.
See [NOTES.md](./NOTES.md).
