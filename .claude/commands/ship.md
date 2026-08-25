---
description: Full check, then stage and commit. Never pushes.
---

Get the current work committed:

1. Run `node .claude/scripts/check.mjs --full`. If anything fails, stop and show
   me the failure — do not commit broken code.
2. `git status --short` and `git diff` to see exactly what changed.
3. Show me the diff summary and the commit message you propose.
   - **Conventional Commits subject** — `<type>(<scope>): <subject>`, imperative
     mood, lower case, no trailing period. Types and rules are in `CLAUDE.md`.
   - The body says *why* the change was made, not a list of files.
   - Check the type against the diff before proposing it. A `refactor` that
     changes behaviour is mislabelled — split it, or call it `feat`/`fix`.
4. Stage and commit only after I confirm.

Do not push. Do not create a branch unless I ask.

Extra context: $ARGUMENTS
