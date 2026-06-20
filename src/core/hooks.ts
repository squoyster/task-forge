import fs from "node:fs";
import path from "node:path";
import { run } from "../util/exec.js";
import { logInfo, logSuccess } from "../util/logging.js";
import { isExecutable } from "../core/templates.js";

const HOOKS_DIR = ".taskforge/hooks";

export interface HookInstallOptions {
  projectRoot: string;
  dryRun: boolean;
  installHooks: boolean;
}

export function installGitHooks(options: HookInstallOptions): void {
  const { projectRoot, dryRun, installHooks } = options;
  const hooksDir = path.join(projectRoot, HOOKS_DIR);

  if (!installHooks) {
    logInfo("Git hooks installation skipped (installHooks: false).");
    return;
  }

  if (dryRun) {
    logInfo("Git hooks would be installed:");
    logInfo(`  .taskforge/hooks/pre-commit  (delegates to: taskforge _hook pre-commit)`);
    logInfo(`  .taskforge/hooks/pre-push     (delegates to: taskforge _hook pre-push)`);
    logInfo(`  git config core.hooksPath .taskforge/hooks`);
    return;
  }

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  fs.writeFileSync(path.join(hooksDir, "pre-commit"), generatePreCommitHook(), { mode: 0o755 });
  fs.writeFileSync(path.join(hooksDir, "pre-push"), generatePrePushHook(), { mode: 0o755 });

  setHooksPath(projectRoot);

  logSuccess("Git hooks installed: .taskforge/hooks/pre-commit, pre-push (delegate to taskforge _hook)");
  logInfo("Set git config core.hooksPath to .taskforge/hooks");
  logInfo("Note: post-commit audit writing removed — git history is the audit.");
}

export async function setHooksPath(projectRoot: string): Promise<void> {
  await run("git", ["config", "core.hooksPath", HOOKS_DIR], projectRoot);
}

export function checkHooks(projectRoot: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const hooksDir = path.join(projectRoot, HOOKS_DIR);

  // pre-commit and pre-push are the only managed hooks (post-commit removed).
  const requiredHooks = ["pre-commit", "pre-push"];
  for (const hook of requiredHooks) {
    const hookPath = path.join(hooksDir, hook);
    if (!fs.existsSync(hookPath)) {
      issues.push(`Missing hook: .taskforge/hooks/${hook}`);
    } else if (!isExecutable(hookPath)) {
      issues.push(`Hook not executable: .taskforge/hooks/${hook}`);
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Thin pre-commit hook — delegates to `taskforge _hook pre-commit` so the
 * logic lives in testable TypeScript (core/hook-logic.ts). Fails open with a
 * warning if taskforge is not on PATH (a missing CLI should not brick git).
 */
function generatePreCommitHook(): string {
  return `#!/usr/bin/env bash
# TaskForge managed pre-commit hook — delegates to taskforge _hook
# Do not edit directly — managed by taskforge init

set -euo pipefail

if ! command -v taskforge >/dev/null 2>&1; then
  echo "warning: taskforge not on PATH; skipping TaskForge pre-commit checks" >&2
  exit 0
fi

exec taskforge _hook pre-commit
`;
}

/**
 * Thin pre-push hook — delegates to `taskforge _hook pre-push` (the enforcement
 * boundary: gate-stamp + branch-ownership checks). Git passes <remote> <url>
 * as args and one "<local_ref> <local_sha> <remote_ref> <remote_sha>" line per
 * ref on stdin; taskforge reads the refs from stdin.
 */
function generatePrePushHook(): string {
  return `#!/usr/bin/env bash
# TaskForge managed pre-push hook — delegates to taskforge _hook
# Do not edit directly — managed by taskforge init

set -euo pipefail

if ! command -v taskforge >/dev/null 2>&1; then
  echo "warning: taskforge not on PATH; skipping TaskForge pre-push checks" >&2
  exit 0
fi

exec taskforge _hook pre-push
`;
}
