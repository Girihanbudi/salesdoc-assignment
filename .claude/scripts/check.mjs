#!/usr/bin/env node
/**
 * Quality gate invoked by Claude Code hooks. THE ONLY PROJECT-SPECIFIC FILE.
 * Language-agnostic: fill in CHECKS below with whatever your stack uses.
 *
 *   node check.mjs           PostToolUse: lint + typecheck the file just edited
 *   node check.mjs --full    Stop:        lint + typecheck + full test suite
 *
 * Exit 2 is the whole mechanism: stderr is fed back to Claude, which must fix
 * the error before continuing. Exit 0 = silent pass.
 *
 * (Written in Node because Claude Code already requires Node — this adds no
 * dependency to a Python, Go, Rust, or any other project.)
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

// ---------------------------------------------------------------------------
// The stack: Node 22 + TypeScript, npm workspaces (apps/api, apps/web,
// packages/shared). Return null from any step to skip it.
// ---------------------------------------------------------------------------
const CHECKS = {
  /** Extensions treated as source. Edits to anything else skip the gate. */
  sourcePattern: /\.(ts|tsx|mjs)$/,

  /** @param {string} file path just edited @returns {[string,string[]]|null} */
  lint: (file) => ['npx', ['--no-install', 'eslint', '--fix', file]],
  /** @returns {[string,string[]]|null} */
  typecheck: () => ['npm', ['run', 'typecheck']],
  /** @returns {[string,string[]]|null} */
  test: () => ['npm', ['run', 'test', '--', '--run']],

  /**
   * Build before testing: the static-serving tests assert against a real
   * `apps/web/dist`, so on a clean checkout they fail with 404s. Locally they
   * passed on a stale dist left by an earlier build, which meant the suite was
   * green on this machine and red anywhere else.
   *
   * @returns {[string,string[]]|null}
   */
  build: () => ['npm', ['run', 'build']],
};

/**
 * Read the hook payload Claude Code writes to stdin.
 * @returns {Promise<object>} parsed payload, or `{}` if stdin is empty/invalid
 */
async function readHookPayload() {
  if (process.stdin.isTTY) return {};
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * The repo root. Every check runs from here regardless of the caller's cwd.
 *
 * Without this, an inherited cwd inside a workspace makes npm resolve to that
 * workspace's package.json — so `npm run typecheck` fails with "Missing script"
 * even though the root defines it.
 *
 * realpath matters on Windows: CLAUDE_PROJECT_DIR can arrive with a lowercase
 * drive letter (`d:\...`), and ESM treats `d:\` and `D:\` as different modules.
 * That silently gives vitest two copies of itself — the runner registers under
 * one and the test files import the other, so every suite fails with
 * "failed to find the runner". realpathSync.native returns the OS's own casing.
 */
const ROOT = (() => {
  const raw = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  try {
    return realpathSync.native(raw);
  } catch {
    return raw; // Path unreadable — let the checks themselves report why.
  }
})();

/**
 * Run one command from the repo root, capturing combined output.
 * @param {[string, string[]]|null} cmd tuple of [bin, args], or null to skip
 * @returns {{ok: boolean, out: string}} ok=true when skipped or exit 0
 */
function run(cmd) {
  if (!cmd) return { ok: true, out: '' };
  const [bin, args] = cmd;
  const r = spawnSync(bin, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    // Default is 1MB, and vitest on a CI runner blows past it — spawnSync then
    // returns ENOBUFS, which reads as "npm is broken" rather than "too much
    // output". Nothing here streams, so there is no reason to cap it at all.
    maxBuffer: Infinity,
  });
  if (r.error) return { ok: false, out: `${bin}: ${r.error.message}` };
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

const full = process.argv.includes('--full');
// --full checks everything, so it needs no payload. Skipping the read matters:
// stdin is only closed for us when a hook supplies it, so reading here would
// hang a manual `node check.mjs --full` from a terminal or a script.
const payload = full ? {} : await readHookPayload();
const file = payload?.tool_input?.file_path;

const steps = full
  ? [CHECKS.lint('.'), CHECKS.typecheck(), CHECKS.build(), CHECKS.test()]
  : [CHECKS.lint(file), CHECKS.typecheck()];

// Nothing configured yet. Silent locally, but NEVER silently green in CI —
// a passing check that checked nothing is worse than a failing one.
if (steps.every((s) => s === null)) {
  if (!process.env.CI) process.exit(0);
  console.error('No checks configured in .claude/scripts/check.mjs (CHECKS is empty).');
  process.exit(1);
}

// Per-edit mode on a non-source file (docs, config, lockfile) -> nothing to do.
if (!full && (!file || !CHECKS.sourcePattern.test(file))) process.exit(0);

const failures = steps.map(run).filter((r) => !r.ok);
if (failures.length === 0) process.exit(0);

console.error(failures.map((f) => f.out).join('\n\n'));
process.exit(2);
