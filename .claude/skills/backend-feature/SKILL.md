---
name: backend-feature
description: Checklist for adding or changing a backend endpoint — route, validation, handler, errors, tests, migration. Use when creating an API endpoint, service method, or any server-side business logic.
---

# Backend feature

Order matters. Steps 1 and 2 come before any implementation code.

## 1. Scenario list

Write it out in plain text before touching code:

- happy path
- each invalid input (missing field, wrong type, out of range)
- unauthenticated / wrong user
- downstream failure (DB down, upstream 500, timeout)

## 2. Failing test

Write it. Run it. Confirm it fails because the feature is missing, not because
the test is broken.

## 3. Route

- Verb and path match existing conventions in this repo — go look.
- Auth middleware applied. A new route without an explicit auth decision is a bug.

## 4. Validation schema

Parse the request body/params into a typed value at the boundary. Everything
downstream receives the parsed type, never the raw request.

Reject unknown fields rather than ignoring them.

## 5. Handler

Thin. It orchestrates: validate → call service → map result to response. Business
logic lives in the service layer where it can be tested without HTTP.

## 6. Errors

- One envelope shape for the whole API. Match what already exists.
- Map domain errors to status codes at the boundary; do not throw HTTP errors
  from deep in the service layer.
- Never leak a stack trace or SQL string to the client. Log it, return a code.

## 7. Migration

- Additive first: new nullable column, backfill, then enforce NOT NULL. Never a
  destructive migration in the same deploy as the code that needs it.
- Write the down migration. If it can't be reversed, say so explicitly.
- Index anything you filter or join on.

## 8. Docs

JSDoc on every export: `@param`, `@returns`, and `@throws` where it can throw.

## Before saying done

- All scenarios from step 1 have a test.
- Tests pass, lint passes, typecheck passes.
- No secret is logged on any path, including the error path.
