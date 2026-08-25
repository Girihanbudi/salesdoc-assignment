#!/usr/bin/env node
/**
 * PreToolUse guard. Blocks irreversible commands; everything else runs freely.
 *
 * Exit 2 = block the tool call and tell Claude why. Exit 0 = allow.
 *
 * SCOPE: this stops ACCIDENTS, not a determined bypass. Command matching is
 * string-based, so `sh -c "..."`, an npm script, or `gh` can route around it.
 * It is a seatbelt, not a sandbox. Real isolation = a container or a VM.
 */
/** Irreversible operations, each with the reason shown to Claude. */
const BLOCKED = [
  // Pushing a feature branch is fine. These are the pushes that aren't.
  [/\bgit\s+push\b.*(--force\b|-f\b|--delete\b)/, 'force/delete push rewrites remote history'],
  [/\bgit\s+push\b.*\b(main|master)\b/, 'pushing straight to main — push a branch and open a PR'],
  [/\bgh\s+pr\s+merge\b/, 'merging is the human’s call — open the PR and leave it'],
  [/\bgh\s+(repo|release)\s+delete\b/, 'deletes a repo or release'],
  [/\bgit\s+reset\s+--hard\b/, 'discards uncommitted work irreversibly'],
  [/\bgit\s+clean\b.*-[a-z]*f/, 'deletes untracked files irreversibly'],
  [/\bgit\s+checkout\s+--\s/, 'discards local changes — use git stash'],
  [/\bgit\s+restore\b(?!.*--staged)/, 'discards local changes — use git stash'],
  [/\bgit\s+branch\s+-D\b/, 'force-deletes a branch — use -d'],
  [/\bgit\s+(rebase|filter-branch|filter-repo)\b/, 'rewrites history'],
  [/\bgit\s+commit\b.*--amend\b/, 'rewrites a commit — make a new one'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'destroys stashed work'],
  [/\bgit\s+(tag\s+-d|push\s+--tags\s+--force)/, 'destroys tags'],
  [/\bgit\s+remote\s+(remove|rm|set-url)\b/, 'changes where code is pushed'],
  [/\bgit\s+reflog\s+expire\b|\bgit\s+gc\b.*--prune/, 'destroys the recovery log'],
  [/\brm\s+-[rRf]+\s.*(\s\/|~|\.\.)/, 'recursive delete outside the project'],
  [/\b(shutdown|reboot|mkfs|dd\s+if=)\b/, 'system-level destructive command'],
  [/\bnpm\s+publish\b|\bnpm\s+unpublish\b/, 'publishes to the public registry'],
  [/>\s*\.env\b|\brm\b.*\.env\b/, 'never overwrite or delete .env'],
];

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // Not a payload we understand — don't block on our own bug.
}

if (payload.tool_name !== 'Bash') process.exit(0);

const cmd = payload.tool_input?.command ?? '';

for (const [pattern, reason] of BLOCKED) {
  if (pattern.test(cmd)) {
    console.error(
      `Blocked: ${reason}.\n` +
        `Command: ${cmd}\n` +
        `If this is genuinely needed, ask the user to run it themselves.`
    );
    process.exit(2);
  }
}

process.exit(0);
