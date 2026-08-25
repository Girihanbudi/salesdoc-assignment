---
description: Full check, then stage and commit. Never pushes.
---

Get the current work committed:

1. Run `node .claude/scripts/check.mjs --full`. If anything fails, stop and show
   me the failure — do not commit broken code.
2. `git status --short` and `git diff` to see exactly what changed.
3. Show me the diff summary and the commit message you propose. The message says
   *why* the change was made, not a list of files.
4. Stage and commit only after I confirm.

Do not push. Do not create a branch unless I ask.

Extra context: $ARGUMENTS
