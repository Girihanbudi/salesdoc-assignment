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
packages/shared              zod models + wire contracts
        │                    (the API validates with them, the client infers)
        ├──────────────┐
        ▼              ▼
apps/api             apps/web
  routes/              pages/      one per route
  handlers/            routes/     route table + paths
  controllers/         components/ shell, cards, ui primitives
  repositories/        hooks/      usePoll, useToasts
  db/                  lib/        fetcher (transport + error mapping)
```

In production there is **one process on one port**: Fastify serves the API *and*
`apps/web/dist`. Same-origin in dev too (Vite proxies to `:3000`), so
`fetch('/api/leads')` is identical in both — no CORS, no base-URL env var.

### Server layers

One direction only; a lower layer never imports an upper one.

```
routes ──▶ handlers ──▶ controllers ──▶ repositories ──▶ db/store
```

| Layer | Responsibility | Never |
|---|---|---|
| `routes/` | uri, zod schema, handler reference | contains logic |
| `handlers/` | map a controller result to a status | parses, queries, or decides |
| `controllers/` | every business decision | touches `request`/`reply` |
| `repositories/` | every read and write | contains rules |
| `db/` | the in-memory Maps and the seed | contains queries |

`container.ts` is the composition root — the only place that knows how the
pieces connect. `dialer.controller.ts` is the one genuinely interesting file.

### The one design decision worth knowing

Everything nondeterministic is **injected**, not imported:

```ts
createDialer({ sessions, calls, crmSync, clock, ring })
```

Production passes `Date`, `randomUUID`, `Math.random`, and `setTimeout`. Tests
pass a fake clock, a counter, a scripted random sequence, and a manual timer
queue — so "line 1 connects, line 2 is cancelled" is asserted exactly, with no
sleeping and no flake. `clock.schedule` returns a *canceller*, which is what
makes a losing line's pending outcome droppable.

### Request flow

```
POST /api/sessions      -> validate leadIds, build session (STOPPED)
POST /:id/start         -> fillLines(): dial up to 2, schedule each outcome
   ...outcome fires     -> CONNECTED? claim winner, cancel the other line
                           otherwise: count it, free the line, refill
   ...terminal          -> crmSync: guard on callId, upsert contact,
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
| `apps/api/src/controllers/dialer.controller.ts` | the state machine — **the interesting file** |
| `apps/api/src/controllers/crm-sync.controller.ts` | idempotency guard + orchestration |
| `apps/api/src/mocks/mock-crm.client.ts` | stands in for the external CRM — the swap point |
| `apps/api/src/db/store.ts` | the in-memory Maps |
| `apps/api/src/server/` | Fastify assembly, envelope, error handler, plugins |
| `apps/api/src/test/harness.ts` | fake clock/random/timers for the engine |
| `apps/web/src/pages/` | one component per route |
| `apps/web/src/lib/http.ts` | transport: response in, data or `ApiError` out |
| `apps/web/src/constant/messages/` | one file per resource, mirroring `ERR` in the API |
| `packages/shared/src/models/` | zod domain models, one per file, mirroring the brief |
| `packages/shared/src/contracts/` | wire shapes: requests, read models, response envelope |

There is no database. State lives in memory and resets on restart — permitted by
the brief, and noted in [NOTES.md](./NOTES.md).

## Screens

| Route | Shows |
|---|---|
| `/dashboard` | index cards, each opening its area |
| `/dial` | lead picker; `?session=` shows the live board |
| `/sessions` | session history |
| `/sessions/:sessionId` | every call a session placed |
| `/crm-activities` | everything written to the CRM |
| `/crm-activities/:callId` | one record with its lead and call |

`/` redirects to `/dashboard`; anything unmatched shows a 404 that names the bad
path rather than silently bouncing.

## API

Every response we own is wrapped in one envelope:

```jsonc
{ "success": true,  "data": {  }, "meta": { "requestId": "req-4", "timestamp": "..." } }
{ "success": false, "error": { "code": "SESSION.NOT_FOUND", "message": "...",
                               "details": [{ "path": "leadIds", "message": "..." }] },
  "meta": {  } }
```

`success` is a literal, so a client discriminates on it rather than probing
shapes. Codes are the contract; messages are not.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness |
| `GET` | `/api/me` | the signed-in agent |
| `GET` | `/api/leads` | seeded leads |
| `POST` | `/api/sessions` | create from `{ agentId, leadIds[] }` |
| `GET` | `/api/sessions` | session history |
| `GET` | `/api/sessions/active` | the agent's running session, or `null` |
| `POST` | `/api/sessions/:id/start` | begin dialing |
| `POST` | `/api/sessions/:id/stop` | cancel active calls |
| `GET` | `/api/sessions/:id` | **the poll endpoint** — hydrated live view |
| `GET` | `/api/sessions/:id/detail` | after-the-fact log |
| `POST` | `/api/sessions/:id/calls/:callId/end` | wrap up the winner |
| `GET` | `/api/activities` | our CRM record, newest first |
| `GET` | `/api/activities/:callId` | one record + lead + call |
| `GET` | `/leads/:id/crm-activities` | a lead's activities |
| `GET` | `/mock-crm/contacts` | the mock CRM's contacts |
| `GET` | `/mock-crm/activities` | the mock CRM's activities |

**`/mock-crm/*` is deliberately not enveloped.** It stands in for a third
party's system, and a real CRM would not adopt our response shape — keeping it
raw makes the integration boundary visible in the response itself.

Interactive docs at **`/docs`** (Swagger UI, generated from the zod schemas).

## Deployment

One container, one process, one port — Fastify serves the API *and* the built
frontend.

```bash
npm run docker:up      # build + run, http://localhost:3000
npm run docker:logs    # follow the logs
npm run docker:down    # stop and remove
```

**Docker Desktop must be running first.** If it is not, the command fails with
`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file
specified` — that named pipe only exists while Docker Desktop is up, and the
message does not say so.

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

### Releasing

Merging to `main` means "this is good". Tagging means "ship this". They are
separate decisions, so they have separate triggers.

```
branch off main  ->  PR to main  ->  merge  ->  tag vX.Y.Z  ->  deploy
                     └ check.mjs, locally    └ release.yml ┘
```

| Workflow | Fires on | Does |
|---|---|---|
| `release.yml` | tag matching `v*` | lint, typecheck, tests, builds + boots the Docker image, then deploys |

Actions runs on a tag and nothing else. Before merging a PR, run the same gate
locally — `node .claude/scripts/check.mjs --full`.

Cutting a release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Three things worth knowing:

- **The deploy is pinned to the tagged commit** (`&ref=<sha>`). Without that,
  Render would build whatever `main` points at now, so a tag cut yesterday
  would ship today's `main` — the opposite of what a tag means.
- **The gate runs again at release time.** `main` was green when it merged, but
  a tag can point at any commit, including one that never went through a PR.
- **Render's own auto-deploy must be off** — Settings → Build & Deploy →
  Auto-Deploy. Otherwise every merge deploys and the tag decides nothing.

Setup, once: create a Deploy Hook under Settings → Deploy Hook, and add it as
the repository secret `RENDER_DEPLOY_HOOK`.

Hosted on Render's free tier from `render.yaml`. That tier sleeps after ~15
minutes idle, so a cold first request takes ~30–50s and in-memory state resets.
See [NOTES.md](./NOTES.md).
