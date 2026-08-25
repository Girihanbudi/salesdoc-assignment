---
name: frontend-component
description: Checklist for building a UI component — props, state, loading and error states, accessibility, test. Use when creating or substantially changing a frontend component, page, or form.
---

# Frontend component

## Before writing it

Look for an existing component that already does this. Reusing one you found is
better than a new one that duplicates it.

Decide where it lives: shared only if a second caller exists *today*.

## Inputs (props / parameters / attributes)

- Narrow the type. An enum of `idle | loading | error` beats a bare string.
- No boolean explosion — three booleans that can't co-occur are one enum.
- No untyped escape hatch (`any`, `object`, `interface{}`). No optional input the
  component immediately defaults; make it required.

## State

- Derive rather than store. If it can be computed from props during render,
  compute it — a second source of truth is a sync bug.
- Server data belongs in whatever data layer this repo already uses. Do not add
  a second one.

## Every async view needs three states

Loading, error, empty. An empty list and a failed fetch must not look identical.
Error states say what to do next, not just "Something went wrong".

## Accessibility — not optional

- Native element first: `<button>`, `<a href>`, `<input type="date">`. A `div`
  with `onClick` is not a button and never will be.
- Every input has a label tied to it. Placeholder is not a label.
- Focus is visible. Focus moves sensibly after a modal opens or closes.
- Colour is never the only signal for state.

## Test

One test that renders it and asserts the user-visible behaviour — query by role
and label, not by class name or test id where a role exists.

## Before saying done

- Loading, error, and empty states all render.
- Keyboard-only: reachable, operable, focus visible.
- No new dependency added without asking.
