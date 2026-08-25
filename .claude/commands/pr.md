---
description: Push the current branch and open a PR to main. Never merges, never tags.
---

Open a pull request for the current branch:

1. Refuse if the current branch is `main`. Say so and stop.
2. Run `node .claude/scripts/check.mjs --full`. If anything fails, stop and show
   me the failure — a PR that cannot pass its own gate wastes a CI run.
3. `git status --short` — if anything is uncommitted, stop and tell me. Use
   `/ship` first.
4. `git push -u origin HEAD`.
5. Authenticate `gh` for this command only (never echo the token):

   ```bash
   export GH_TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' \
     | git credential fill | sed -n 's/^password=//p')
   ```

   If `gh` is missing: `winget install --id GitHub.cli --silent`.
6. Show me the title and body you propose, then create it after I confirm:

   ```bash
   gh pr create --base main --head "$(git branch --show-current)" \
     --assignee Girihanbudi --title ... --body ...
   ```

   - Title follows Conventional Commits, same rules as a commit subject.
   - Body explains *why*, what a reviewer should look at hardest, and any
     manual setup needed before merge. Not a list of files.
   - Skip `--add-reviewer`: it needs `read:org`, which the token lacks, and
     GitHub refuses self-review anyway.
7. Print the PR URL and stop.

Do not merge. Do not create a release tag. Do not call the deploy hook.

Extra context: $ARGUMENTS
