# Notes

## Tradeoffs

**In-memory storage.** The brief permits it, so there is no database. State
resets on restart, which on Render's free tier happens after ~15 minutes idle.
Leads re-seed; in-flight sessions are lost. A real deployment would put
`store.ts` behind Postgres — the `Store` interface is already the seam for it.

**Polling, not SSE.** The brief asks for a 1–2s poll, so that is what this does
(1.5s). SSE or a WebSocket would be better: lower latency on the winner reveal
and no wasted requests while nothing changes. The poll endpoint returns one
fully-hydrated payload so the client never joins calls to leads itself.

**The CRM sync calls its module directly, not over HTTP to itself.** It writes
to the same store the `/mock-crm` routes read, so results are identical and
inspectable, and a self-request would only add failure modes. In production the
CRM is a real network hop and this becomes a client with retries and a circuit
breaker.

**Call outcomes are mocked** — weighted random, 2–6s ring. There is no SIP,
Twilio, or WebRTC, and the brief does not ask for any. The real telephony
concern this design would have to answer is that the losing lines are people
who picked up and got hung up on (*abandoned calls*, FCC-capped at 3% in the US).

**No auth.** Every request is treated as `agent-1`. Session ownership and an
agent identity would be the first thing added.

**Compose is one service, not a stack.** `docker compose up` exists as the
one-command demo path for a reviewer who would rather not install Node. There
is no second service because there is no database — a compose file that starts
Postgres nothing connects to would be theatre. It gains a real healthcheck so
`docker compose ps` reports `healthy` rather than just `running`.

**shadcn/ui without Radix.** The seven primitives used here (button, card,
badge, checkbox, table, textarea) are styled elements with `cva` variants and
need no portal or focus trap, so they are written in shadcn's idiom — owned
files under `components/ui/`, `cn()` + `cva` — without pulling Radix in for
components that would not use it. Radix earns its place at the first dialog or
popover.

**Light theme only.** The reference design has no dark variant, so building one
would be inventing a design rather than implementing one.

### Two deliberate deviations from the brief

1. **`CallStatus` has a sixth value, `DIALING`.** The brief lists five, all
   terminal, but a call needs a status between placement and outcome. The five
   specified values remain the only terminal ones, and only terminal calls sync
   to the CRM.
2. **CRM sync carries 300–800ms of simulated latency.** Screen 2 is required to
   show "CRM activity creation status per call/lead". The sync is an in-process
   function call that would otherwise settle in the same tick, so the status
   would only ever render `synced` and the requirement would be met in name
   only. The latency makes `pending → synced` observable and models the real
   network hop.

### One non-obvious design decision

**A connected call syncs to the CRM at wrap-up, not on answer.** Syncing on
answer would claim the `callId` idempotency key against a placeholder
disposition, so the agent's real disposition would be silently discarded when
they hung up. `terminate()` therefore skips the sync for `CONNECTED` only, and
`endCall()` owns it. `stop()` covers the gap: a session stopped mid-conversation
still records the call, with a `CALLBACK` disposition, rather than losing it.

## What I'd do next

1. SSE for the winner reveal — polling adds up to 1.5s of dead air on the one
   event that matters.
2. Postgres behind the `Store` interface, so a redeploy doesn't erase history.
3. A real telephony provider behind the existing `schedule`/`random` seams —
   the state machine does not know its outcomes are fake.
4. Playwright E2E for the full browser path; the current suite stops at the
   API boundary and one component smoke test.
5. Auth and per-agent sessions.
6. Retry with backoff on CRM sync. The `failed` state exists and is rendered,
   but nothing currently retries it.

## How I used AI tools, and what I verified

Built with Claude Code (Opus 5), driving a quality gate that runs lint +
typecheck on every file written and the full test suite at the end of every
turn (`.claude/scripts/check.mjs`). The gate is the same command CI runs, so
they cannot drift.

AI wrote most of the code. What I checked rather than assumed:

**I mutation-tested the idempotency guard, and my first test was wrong.**
Deleting `if (syncedCallIds.has(call.id)) return` from `crm.ts` left all 17
tests passing. The test drove the replay through `endCall()`, which returns
early because `winnerCallId` is already null — so the guard was never reached
and the test could not fail. Rewrote it to call `syncToCrm` directly. The
mutation now fails two tests, and passes again when restored. Re-run it:

```bash
# in crm.ts, comment out the syncedCallIds guard
npx vitest run --project server     # 2 failures, both in crm.test.ts
```

**Concurrency invariant.** `activeCallIds.length <= 2` is asserted after every
single tick across a full six-lead queue, not just at the end
(`dialer.test.ts`).

**Metrics arithmetic — my expectation was wrong, the engine was right.** I
expected 6 attempts in a six-lead session; it reported 5. Correct: the connect
on line 4 stops the queue, so lead-6 is never dialed. The test now asserts
`connected + failed + canceled === attempted` so every attempt lands in exactly
one bucket.

**Cancelled timers really are cancelled.** After `stop()`, the harness drains
every remaining timer and re-asserts the statuses. If a cancelled outcome fired
it would consume a random value the harness does not have and throw.

**End-to-end against the production build**, one process on one port:

- winner election live: line 2 connected, line 1 flipped to
  `CANCELED_BY_DIALER`, metrics `{attempted:2, connected:1, canceled:1}`
- replaying the wrap-up returned `409 NOT_ACTIVE`, and the mock CRM held 3
  activities across 3 unique `callId`s — the duplicate's `NOT_INTERESTED` did
  not overwrite the agent's `INTERESTED`
- contacts: leads seeded *without* a `crmExternalId` got new contacts
  (`crm-contact-3594c65b`); the lead seeded *with* `crm-contact-88213` kept it,
  no duplicate
- routing: `/api/nonexistent` → 404 JSON envelope, `/some/client/route` → 200
  SPA fallback. The fallback must not swallow API 404s and does not.

**`npm run dev` was broken, and nothing in the test suite could have caught
it.** Every test drives Fastify through `inject()`, and the production path
runs compiled JavaScript — so the dev entrypoint was the one path nothing
exercised. Running the literal command from the brief showed the API process
dying instantly: Node's `--experimental-strip-types` does not remap the
`./app.js` specifier to `app.ts`, so the server never started and Vite proxied
into a closed port. Switched to `tsx watch`. Verified by driving a full session
through `localhost:5173` and watching it proxy to the API.

The lesson: run the exact command the reader will run. A passing test suite says
nothing about the command in your README.

**The frontend silently stopped being served, and the symptom lied.** Adding
Swagger broke static file serving: `@fastify/static` was registered in
`index.ts` *after* every route, so it stopped matching, and each request fell
through to the SPA fallback. That fallback returned `index.html` — for
JavaScript and CSS requests too — with a `404` status, because `reply.sendFile`
inside a `setNotFoundHandler` keeps the 404. So `/api/health` was fine, `/docs`
was fine, the container reported **healthy**, and the page would have rendered
blank. Registration moved into `buildApp` ahead of the routes, and the fallback
now sets an explicit `200`.

Caught by running the container, not by the tests. Five regression tests now
cover it — root serves HTML, hashed assets are *not* HTML, client routes fall
back with 200, API routes still 404 as JSON, `/docs` still works. In fairness
to their limits: I mutation-tested them by swapping the registration order and
they still passed, because the ordering conflict only manifests when static is
registered after the routes. They pin the observable outcome, not that specific
mistake.

**The Docker build caught a bug that every local build hid.** `.dockerignore`
excluded `dist/` but not `tsconfig.tsbuildinfo`, so the build stage received a
build cache whose outputs were missing. `tsc --build` read it, concluded the
project was already built, emitted nothing, and **exited 0**. A green build
shipping an empty image. Locally it never reproduced, because the incremental
cache and its outputs were both present. The first symptom was a misleading
`Cannot find module '@salesdoc/shared'` in a later workspace — the cause was two
steps upstream. Verified fixed by running the image end to end, not by trusting
the build's exit code.

The general lesson I applied afterwards: an exit code of 0 from a tool with a
cache is not evidence that it did anything.

**What I did not verify:** the deployed Render URL under a cold start, and any
browser-level interaction beyond the component tests. No load testing, and no
check of behaviour when two agents drive the same session concurrently — there
is no auth, so nothing prevents it.

The seed data is deliberately split — four leads without a `crmExternalId`, two
with — so the "create the contact first" branch runs on the first demo, not
only in a test.
