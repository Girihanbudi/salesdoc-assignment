# Project rules

## What this is

A 2-line **multi-line dialer** + mock CRM. One agent, two simultaneous calls;
the first to connect is the *winner* and takes the agent, the other is hung up
as `CANCELED_BY_DIALER`. Every terminal call writes an idempotent CRM activity.

Call outcomes are **mocked** — there is no telephony, no SIP, no Twilio. The
substance is the concurrency-bounded state machine and the idempotent write-behind.

`apps/api/src/dialer.ts` is the only genuinely interesting file. The rest is
plumbing around it. Read it before changing anything that touches calls.

## Stack & layout

- Language / runtime: TypeScript on **Node 22** (pinned in `package.json` → `engines`)
- Package manager: **npm workspaces** — use only this one. Never mix lockfiles.
- Frontend: `apps/web/` — Vite + React 19 + Tailwind 4 (dev port **5173**)
- Backend: `apps/api/` — Fastify 5 (dev port **3000**)
- Shared: `packages/shared/` — zod schemas + inferred types, imported by both
- Database: **none**. In-memory `Map`s in `apps/api/src/store.ts`, seeded on
  boot. State resets on restart — that is expected and documented in NOTES.md.

In production a single Fastify process serves the API *and* `apps/web/dist`, on
one port. In dev they are two processes and Vite proxies `/api` + `/mock-crm`
to 3000. Same-origin in both, so there is no CORS anywhere and no base-URL env var.

### Commands

- All tests: `npm test`
- **Single test file: `npm test -- dialer`** — use this while iterating, not the full suite
- Lint / format: `npm run lint`
- Type check: `npm run typecheck`
- Dev (both apps): `npm run dev`
- Production build + run: `npm run build && npm start`

### Conventions

- Import style: alias `@/` → that package's `src/`. Cross-package imports go
  through the workspace name (`@salesdoc/shared`), never a deep relative path.
  No `../../..` chains.
- Env vars: none required to run locally. `PORT` and `NODE_ENV` are read in
  production only. Never read or print `.env` — ask me for a value instead.

### Spec fidelity — this is graded work

The field names in `packages/shared/src/schemas.ts` mirror the assignment brief
1:1. Do not rename, "improve", or add fields to the four spec'd models
(`Lead`, `Call`, `DialerSession`, `CRMActivity`) without saying so explicitly —
a grader diffs these against the brief.

Two deliberate deviations, already agreed, both documented in NOTES.md:
1. `CallStatus` gains a non-terminal `DIALING`. The brief's five values remain
   the only **terminal** ones, and only terminal calls sync to CRM.
2. CRM sync carries ~300-800ms simulated latency so the required per-call
   "CRM activity creation status" actually renders `pending` before `synced`.

## Workflow — backend logic

Non-negotiable order. Do not skip to step 3.

1. **List the test scenarios first**, in plain text, before writing any code:
   happy path, each boundary, each error, unauthorized. Show the list.
2. **Write the failing test.** Run it. Confirm it fails for the right reason.
3. **Write the implementation** — the least code that passes.

Lint and type checks run automatically on every file you write. Fix what comes
back; do not work around it.

CI lands on a separate branch and runs the exact same gate —
`node .claude/scripts/check.mjs --full`. If a check needs to change, change it
there, not in the workflow file. Never add a CI-only step that can't be run
locally.

## Documentation

Every exported/public function, type, and route handler gets a doc comment in
this language's convention (JSDoc, docstring, godoc, rustdoc, …) covering
parameters and return value.

Enforce it through the linter rather than by asking — configure the rule
(`jsdoc/require-jsdoc`, ruff `D`, `revive exported`, `missing_docs`) and
violations bounce back through the existing hook automatically.

Document *why*, not *what*. `// increment i` is noise; a note about why the
retry is capped at 3 is not.

## Server layering — `apps/api/src/`

One direction only. A lower layer never imports an upper one.

```
routes ──▶ handlers ──▶ controllers ──▶ repositories ──▶ db/store
  │            │             │
  │            │             └──────▶ mocks (via an injected client)
  │            └─────────────┴──────▶ utils, constant, types
  └─ schema: zod from @salesdoc/shared, validated BEFORE the handler runs
```

| Folder | Holds | Must never |
|---|---|---|
| `routes/` | uri, schema, handler reference | contain logic |
| `handlers/` | HTTP in, HTTP out | parse, query, or decide |
| `controllers/` | every business decision | touch `request`/`reply`/status codes |
| `repositories/` | every read and write | contain rules |
| `db/` | the Maps and the seed | contain queries |
| `mocks/` | stand-ins for external systems | be imported outside a controller |
| `constant/` | **every** constant, and env parsing | import from a layer above |
| `utils/` | cross-cutting helpers | know about the domain |
| `types/` | shared local types (`AppContext`) | duplicate `@salesdoc/shared` |

`container.ts` is the composition root — the only place that knows how the
pieces connect. `db/store.ts` may only be imported by `repositories/`.

Two greppable checks, worth running after any change in `apps/api/`:

```bash
# Only repositories may reach the store. (container + test harness wire it.)
grep -rn "db/store" src/ --include=*.ts \
  | grep -vE "^src/(repositories|db|test)/|^src/container.ts"

# No raw Map iteration outside the data layer.
grep -rn "\.values()\|\.entries()" src/ --include=*.ts \
  | grep -vE "^src/(repositories|db)/|\.test\.ts:"
```

Tests are exempt from the second rule on purpose: asserting against the store
directly is how a test proves what was *actually persisted*. Reading through
the repository would make the test trust the layer it is testing.

### Where things go — the rules that keep getting broken

- **Constants live in `constant/`.** Not at the top of the file that happens to
  use them. A lookup table, a weight, a default string: `constant/`.
  Exception: a value used once, inside one function, that is meaningless
  elsewhere.
- **Name every parameter object.** A factory or controller taking a `deps`
  object declares an exported `interface XxxDeps`; never an inline
  `{ a: A; b: B }` in the signature. Inline shapes cannot be referenced by a
  caller or a test, and they hide growth.
- **Validation splits by what it needs.** Shape (no state) → route schema.
  Anything needing a repository → controller, throwing `AppError`. There is no
  `validators/` folder; a third home invites drift.
- **Errors are thrown, never constructed as responses.** Throw `AppError`;
  `server/error-handler.ts` is the only place that builds an error body.

## Commit messages — Conventional Commits

Every commit subject starts with a type prefix, per
<https://www.conventionalcommits.org/en/v1.0.0/>:

```
<type>(<optional scope>): <subject>

<body — why, not what>
```

| Type | Use for |
|---|---|
| `feat` | a new capability the user can see |
| `fix` | a bug fix |
| `refactor` | restructuring with no behaviour change |
| `test` | adding or correcting tests only |
| `docs` | README, NOTES, CLAUDE.md, comments |
| `build` | Dockerfile, compose, deps, lockfile, bundler config |
| `ci` | workflow files |
| `chore` | housekeeping that fits nothing above |
| `perf` | a change made for performance |
| `style` | formatting only, no code change |

Rules:

- Subject in the **imperative mood**, lower case, no trailing period:
  `fix: serve the frontend before registering routes`, not `Fixed serving...`.
- Scope is the workspace or area when it narrows usefully: `feat(api):`,
  `refactor(web):`, `build(docker):`.
- **A refactor commit that changes behaviour is mislabelled.** If behaviour
  changes, it is `feat` or `fix` — split the commit rather than blur the type.
- Breaking changes get a `!` before the colon (`feat(api)!:`) and a
  `BREAKING CHANGE:` footer explaining the migration.
- The body explains *why*, not a list of files. `git diff` already lists files.

## Always

- Validate and narrow input at every API boundary. Never trust a request body.
- Never log secrets, tokens, or full request bodies containing credentials.
- Ask before adding a dependency. Say what it replaces and why hand-rolling loses.
- Errors from the API use one envelope shape. Match the existing one.

## Never

- No abstraction for a single caller. No interface with one implementation.
- No barrel / re-export aggregation files.
- No new README, CHANGELOG, or docs file unless asked.
- No committing or pushing unless asked. Never push to `main`; open a PR.

## Working style

Read the code the change touches before editing it. Trace the actual call path.
The smallest diff in the wrong place is a second bug.

When a fix has multiple callers, fix it once in the shared function — not once
per caller.
