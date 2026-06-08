import path from "node:path";
import { execSync } from "node:child_process";

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

export function getTasksDir(repoRoot: string): string {
  return path.join(repoRoot, "tasks");
}

/**
 * Resolve the task-state directory relative to the MAIN repo root,
 * not the worktree root. This ensures the path is correct regardless
 * of whether the command is invoked from the main repo, a proper
 * worktree, or a nested worktree.
 */
export function getTaskStateDir(repoRoot: string): string {
  return path.resolve(getMainRepoRoot(repoRoot), "..", "task-state");
}

export function getTaskFilePath(repoRoot: string, id: string): string {
  return path.join(getTaskStateDir(repoRoot), `${id}.md`);
}

export function getWorktreesDir(repoRoot: string): string {
  const repoName = path.basename(repoRoot);
  return path.resolve(repoRoot, "..", "worktrees", repoName);
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

export function getConfigPath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), "config.yaml");
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
