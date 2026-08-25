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

// ---------------------------------------------------------------------------
// The stack: Node 22 + TypeScript, npm workspaces (apps/server, apps/web,
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
 * Run one command, capturing combined output.
 * @param {[string, string[]]|null} cmd tuple of [bin, args], or null to skip
 * @returns {{ok: boolean, out: string}} ok=true when skipped or exit 0
 */
function run(cmd) {
  if (!cmd) return { ok: true, out: '' };
  const [bin, args] = cmd;
  const r = spawnSync(bin, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.error) return { ok: false, out: `${bin}: ${r.error.message}` };
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

const full = process.argv.includes('--full');
const payload = await readHookPayload();
const file = payload?.tool_input?.file_path;

const steps = full
  ? [CHECKS.lint('.'), CHECKS.typecheck(), CHECKS.test()]
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
