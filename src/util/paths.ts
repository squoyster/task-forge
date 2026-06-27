import path from "node:path";
import { execSync } from "node:child_process";
import type { Config } from "../core/config.js";
import { loadConfig } from "../core/config.js";

let _repoRoot: string | null = null;

export function getRepoRoot(): string {
  if (!_repoRoot) {
    _repoRoot = discoverRepoRoot();
  }
  return _repoRoot;
}

function discoverRepoRoot(): string {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
    return root;
  } catch {
    return process.cwd();
  }
}

export function setRepoRoot(root: string): void {
  _repoRoot = root;
  _configCache.clear();
}

/**
 * Get the main repository root by resolving the shared `.git` directory.
 *
 * Uses `git rev-parse --git-common-dir` which always returns the path to
 * the shared `.git` directory regardless of whether we're in the main repo,
 * a proper worktree, or a nested worktree. The parent of that directory is
 * the main repo root.
 *
 * Falls back to the given repoRoot when not in a git repo (e.g., in tests).
 */
export function getMainRepoRoot(repoRoot: string): string {
  try {
    const gitDir = execSync("git rev-parse --git-common-dir", {
      encoding: "utf-8",
      cwd: repoRoot,
    }).trim();
    return path.resolve(repoRoot, gitDir, "..");
  } catch {
    return repoRoot;
  }
}

// ponytail: per-mainRoot config cache. Config is stable per repo at runtime; cleared on
// setRepoRoot. Ceiling: a config edited mid-process won't re-read until process restart —
// not a real concern (config changes are rare + cross-command).
const _configCache = new Map<string, Config>();
function configFor(mainRoot: string): Config {
  let c = _configCache.get(mainRoot);
  if (!c) {
    c = loadConfig(mainRoot);
    _configCache.set(mainRoot, c);
  }
  return c;
}

/**
 * Resolve the task-state directory. Config-authoritative (TF-SIMP-03):
 * `tasks.stateDir` (default `../task-state`) relative to the MAIN repo root,
 * honored identically from the main checkout and any linked worktree.
 * Accepts an absolute `stateDir`.
 */
export function getTaskStateDir(repoRoot: string): string {
  const mainRoot = getMainRepoRoot(repoRoot);
  return path.resolve(mainRoot, configFor(mainRoot).tasks.stateDir);
}

export function getTaskFilePath(repoRoot: string, id: string): string {
  return path.join(getTaskStateDir(repoRoot), `${id}.md`);
}

/**
 * Resolve the worktrees PARENT directory. Config-authoritative (TF-SIMP-03):
 * `worktrees.root` (default `../worktrees`) relative to the MAIN repo root.
 * Final worktree path = <root>/<repoName>/<taskId>. Uses the MAIN repo name
 * so resolution is identical from the main checkout and any linked worktree.
 */
export function getWorktreesDir(repoRoot: string): string {
  const mainRoot = getMainRepoRoot(repoRoot);
  const repoName = path.basename(mainRoot);
  return path.resolve(mainRoot, configFor(mainRoot).worktrees.root, repoName);
}

export function getWorktreePath(repoRoot: string, id: string): string {
  return path.join(getWorktreesDir(repoRoot), id);
}

export function getTaskforgeDir(repoRoot: string): string {
  return path.join(repoRoot, ".taskforge");
}

export function getCachePath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), "cache.json");
}

export function getConfigJsonPath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), "config.json");
}

export function makeBranchName(id: string, title: string, sessionId?: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");
  const suffix = slug ? `-${slug}` : "";
  const sessionSuffix = sessionId ? `--${sessionId}` : "";
  return `agent/${id}${suffix}${sessionSuffix}`;
}
