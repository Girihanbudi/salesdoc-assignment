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

## Layout

| Path | What |
|---|---|
| `apps/server/src/dialer.ts` | the state machine — **the interesting file** |
| `apps/server/src/crm.ts` | mock CRM store + idempotent sync |
| `apps/server/src/store.ts` | in-memory `Map`s, seeded on boot |
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
docker build -t dialer .
docker run -p 3000:3000 dialer   # http://localhost:3000
```

Hosted on Render's free tier from `render.yaml`. That tier sleeps after ~15
minutes idle, so a cold first request takes ~30–50s and in-memory state resets.
See [NOTES.md](./NOTES.md).
