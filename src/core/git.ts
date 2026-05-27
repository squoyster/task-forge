import simpleGit from "simple-git";
import { execa } from "execa";
import { getWorktreePath, makeBranchName, getTaskStateDir, getRepoRoot } from "../util/paths.js";
import type { ParsedTask } from "./task-store.js";
import { logWarn } from "../util/logging.js";

export interface WorktreeResult {
  path: string;
  branch: string;
  created: boolean;
}

export interface UncommittedWorktree {
  taskId: string;
  status: string;
  dirtyFiles: number;
  branch: string;
  worktreePath: string;
}

/**
 * Check all worktrees for uncommitted changes.
 * Returns a list of worktrees with dirty state, or empty array if clean.
 */
export async function checkUncommittedWorktrees(
  repoRoot: string,
  tasks: ParsedTask[],
): Promise<UncommittedWorktree[]> {
  const git = simpleGit(repoRoot);
  const worktrees = await git.raw("worktree", "list", "--porcelain");
  const results: UncommittedWorktree[] = [];

  const lines = worktrees.split("\n");
  let currentWorktree: { path: string; branch: string } | null = null;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (currentWorktree) {
        const dirty = await checkWorktreeDirty(currentWorktree.path);
        if (dirty > 0) {
          const task = findTaskByWorktree(tasks, currentWorktree.path);
          if (task) {
            results.push({
              taskId: task.id,
              status: task.status,
              dirtyFiles: dirty,
              branch: currentWorktree.branch,
              worktreePath: currentWorktree.path,
            });
          }
        }
      }
      currentWorktree = { path: line.slice(9), branch: "" };
    } else if (line.startsWith("branch ") && currentWorktree) {
      currentWorktree.branch = line.slice(7);
    }
  }

  // Check last worktree
  if (currentWorktree) {
    const dirty = await checkWorktreeDirty(currentWorktree.path);
    if (dirty > 0) {
      const task = findTaskByWorktree(tasks, currentWorktree.path);
      if (task) {
        results.push({
          taskId: task.id,
          status: task.status,
          dirtyFiles: dirty,
          branch: currentWorktree.branch,
          worktreePath: currentWorktree.path,
        });
      }
    }
  }

  return results;
}

/**
 * Check if a worktree has uncommitted changes.
 * Returns the number of dirty files, or 0 if clean.
 */
async function checkWorktreeDirty(worktreePath: string): Promise<number> {
  try {
    const git = simpleGit(worktreePath);
    const status = await git.status();
    return status.files.length;
  } catch {
    return 0;
  }
}

/**
 * Find a task by its worktree path.
 */
function findTaskByWorktree(tasks: ParsedTask[], worktreePath: string): ParsedTask | null {
  for (const t of tasks) {
    if (t.worktree === worktreePath) return t;
  }
  // Fallback: match by worktrees dir pattern
  const match = worktreePath.match(/worktrees[/\\][^/\\]+[/\\](TASK-\d+)/);
  if (match) {
    return tasks.find((t) => t.id === match[1]) ?? null;
  }
  return null;
}

export async function createWorktree(
  repoRoot: string,
  task: ParsedTask,
): Promise<WorktreeResult> {
  const git = simpleGit(repoRoot);
  const worktreePath = getWorktreePath(repoRoot, task.id);
  const branchName = task.branch ?? makeBranchName(task.id, extractTitle(task));

  // Check if worktree already exists
  const worktrees = await git.raw("worktree", "list", "--porcelain");
  if (worktrees.includes(worktreePath)) {
    return { path: worktreePath, branch: branchName, created: false };
  }

  // Check if branch exists
  const branches = await git.branchLocal();
  const branchExists = branches.all.includes(branchName);

  if (branchExists) {
    await execa("git", ["worktree", "add", worktreePath, branchName], {
      cwd: repoRoot,
    });
  } else {
    await execa("git", ["worktree", "add", worktreePath, "-b", branchName], {
      cwd: repoRoot,
    });
  }

  return { path: worktreePath, branch: branchName, created: true };
}

export async function removeWorktree(
  repoRoot: string,
  taskId: string,
): Promise<boolean> {
  const worktreePath = getWorktreePath(repoRoot, taskId);
  // Check if worktree exists before attempting removal
  const git = simpleGit(repoRoot);
  const worktrees = await git.raw("worktree", "list", "--porcelain");
  if (!worktrees.includes(worktreePath)) {
    return false;
  }
  await execa("git", ["worktree", "remove", worktreePath], { cwd: repoRoot });
  return true;
}

export async function removeBranch(
  repoRoot: string,
  branchName: string,
  deleteRemote = false,
): Promise<boolean> {
  const git = simpleGit(repoRoot);
  const branches = await git.branchLocal();
  const branchExists = branches.all.includes(branchName);

  if (!branchExists) {
    return false;
  }

  // Cannot delete the currently checked-out branch
  const current = await git.branch();
  if (current.current === branchName) {
    await git.checkout("main");
  }

  await git.deleteLocalBranch(branchName, true); // force delete

  if (deleteRemote) {
    try {
      await execa("git", ["push", "origin", "--delete", branchName], {
        cwd: repoRoot,
      });
    } catch {
      // Remote branch may not exist — that's fine
    }
  }

  return true;
}

export async function listWorktrees(
  repoRoot: string,
): Promise<{ path: string; branch: string; commit: string }[]> {
  const git = simpleGit(repoRoot);
  const output = await git.raw("worktree", "list", "--porcelain");
  const results: { path: string; branch: string; commit: string }[] = [];
  let current: Partial<{ path: string; branch: string; commit: string }> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) results.push(current as { path: string; branch: string; commit: string });
      current = { path: line.slice(9) };
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7);
    } else if (line.startsWith("HEAD ")) {
      current.commit = line.slice(5);
    }
  }
  if (current.path) results.push(current as { path: string; branch: string; commit: string });

  return results;
}

export async function getCurrentBranch(repoRoot: string): Promise<string> {
  const git = simpleGit(repoRoot);
  const branch = await git.branch();
  return branch.current;
}

export async function commitChanges(
  worktreePath: string,
  message: string,
): Promise<void> {
  const git = simpleGit(worktreePath);
  await git.add(".");
  const status = await git.status();
  if (status.files.length > 0) {
    await git.commit(message);
  }
}

/**
 * Ensure the task-state branch and worktree exist.
 * Creates an orphan branch if neither exists yet.
 * Returns the worktree path, or the state dir if git is unavailable.
 */
export async function ensureTaskStateBranch(repoRoot: string): Promise<string> {
  const stateDir = getTaskStateDir(repoRoot);

  try {
    const git = simpleGit(repoRoot);

    // Check if worktree already exists
    const worktrees = await git.raw("worktree", "list", "--porcelain");
    if (worktrees.includes(stateDir)) {
      return stateDir;
    }

    // Check if branch exists locally or remotely
    const branches = await git.branchLocal();
    const localExists = branches.all.includes("task-state");

    // Check remote
    let remoteExists = false;
    if (!localExists) {
      try {
        await execa("git", ["fetch", "origin", "task-state"], { cwd: repoRoot });
        remoteExists = true;
      } catch {
        remoteExists = false;
      }
    }

    if (localExists || remoteExists) {
      await execa("git", ["worktree", "add", stateDir, "task-state"], { cwd: repoRoot });
    } else {
      // Create the worktree/branch from HEAD, then strip to just task files
      await execa("git", ["worktree", "add", stateDir, "-b", "task-state"], { cwd: repoRoot });
      try {
        const wtGit = simpleGit(stateDir);
        // Remove all tracked files (keep .git)
        await wtGit.raw("rm", "-rf", ".");
        // Place a gitkeep so the branch has content
        const fs = await import("node:fs");
        const path = await import("node:path");
        fs.writeFileSync(
          path.join(stateDir, ".gitkeep"),
          "Task state branch — contains only task Markdown files.\n",
          "utf-8",
        );
        await wtGit.add(".");
        await wtGit.commit("chore: initialize task-state branch");
        await execa("git", ["push", "-u", "origin", "task-state"], { cwd: stateDir });
      } catch {
        // Cleanup may fail if worktree was already modified — proceed
      }
    }
  } catch {
    // Not a git repo or other git error — just ensure the directory exists
    const fs = await import("node:fs");
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
  }

  return stateDir;
}

/**
 * Commit all changes in the task-state worktree and push to remote.
 * Gracefully no-ops if the worktree doesn't exist or isn't a git repo.
 */
export async function commitAndPushTaskState(repoRoot: string, message: string): Promise<void> {
  const stateDir = getTaskStateDir(repoRoot);

  // First check if the worktree directory exists
  const fs = await import("node:fs");
  if (!fs.existsSync(stateDir)) {
    return; // Not yet initialized — skip silently
  }

  try {
    const git = simpleGit(stateDir);
    await git.add(".");
    const status = await git.status();
    if (status.files.length > 0) {
      await git.commit(message);
    }
    try {
      await execa("git", ["push", "origin", "task-state"], { cwd: stateDir });
    } catch {
      // Remote may not exist or be unreachable — local commit is enough
    }
  } catch {
    // Not a git repo or other git error — skip silently
  }
}

/**
 * Pull the latest task-state from origin before reading.
 * Graceful: logs a warning on failure but never throws.
 */
export async function pullTaskState(repoRoot?: string): Promise<void> {
  const root = repoRoot ?? getRepoRoot();
  const stateDir = getTaskStateDir(root);
  const fs = await import("node:fs");
  if (!fs.existsSync(stateDir)) return;

  try {
    await execa("git", ["pull", "--rebase", "origin", "task-state"], { cwd: stateDir });
  } catch {
    // Network unreachable, no remote, or not a git repo — proceed with whatever is on disk
  }
}

function extractTitle(task: ParsedTask): string {
  // Try to extract title from body first line: # TASK-123: Title
  const match = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  if (match) return match[1];
  return task.id;
}

/**
 * Options for jitteredPush().
 */
export interface JitteredPushOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Minimum jitter delay in milliseconds (default: 2000) */
  jitterMinMs?: number;
  /** Maximum jitter delay in milliseconds (default: 10000) */
  jitterMaxMs?: number;
  /**
   * Called after a successful `git pull --rebase` to allow the caller
   * to re-read task state and decide whether to retry.
   * Return true to retry the push; return false to abort.
   * If not provided, always retries up to maxRetries.
   */
  onConflict?: (stateDir: string) => Promise<boolean>;
}

/**
 * Push changes to the task-state branch with jittered retry on
 * non-fast-forward rejection (optimistic concurrency).
 *
 * This wraps the same commit+push flow as commitAndPushTaskState but
 * adds retry logic: on a non-fast-forward push rejection, it executes
 * `git pull --rebase`, waits a random jitter period (2-10s by default),
 * and retries up to `maxRetries` times.
 *
 * If the `onConflict` callback is provided, it is called after each rebase
 * so the caller can re-read task state and abort if another agent claimed
 * the task.
 *
 * Returns true if the push succeeded, false if all retries were exhausted
 * or the operation was aborted.
 */
export async function jitteredPush(
  repoRoot: string,
  message: string,
  options?: JitteredPushOptions,
): Promise<boolean> {
  const stateDir = getTaskStateDir(repoRoot);

  // First check if the worktree directory exists
  const fs = await import("node:fs");
  if (!fs.existsSync(stateDir)) {
    return true; // Not yet initialized — pretend success
  }

  const maxRetries = options?.maxRetries ?? 3;
  const jitterMin = options?.jitterMinMs ?? 2000;
  const jitterMax = options?.jitterMaxMs ?? 10000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Stage and commit
      const git = simpleGit(stateDir);
      await git.add(".");
      const status = await git.status();
      if (status.files.length > 0) {
        await git.commit(message);
      }

      // Push
      await execa("git", ["push", "origin", "task-state"], { cwd: stateDir });
      return true; // Push succeeded
    } catch (err) {
      // If we've exhausted retries, give up
      if (attempt >= maxRetries) {
        logWarn(`jitteredPush: exhausted ${maxRetries} retries for push to task-state`);
        return false;
      }

      // Only retry on non-fast-forward rejection
      if (!isNonFastForwardRejection(err)) {
        logWarn(`jitteredPush: push failed with unrecoverable error, skipping retry`);
        return false;
      }

      // Pull rebase to catch up
      try {
        await execa("git", ["pull", "--rebase", "origin", "task-state"], { cwd: stateDir });
      } catch {
        logWarn(`jitteredPush: git pull --rebase failed, aborting retry`);
        return false;
      }

      // Jitter wait
      const delay = jitterMin + Math.floor(Math.random() * (jitterMax - jitterMin + 1));
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Call the conflict callback if provided — it can abort the retry
      if (options?.onConflict) {
        const shouldContinue = await options.onConflict(stateDir);
        if (!shouldContinue) {
          return false;
        }
      }

      // Continue to next attempt (retry push)
    }
  }

  return false;
}

/**
 * Detect whether an execa error represents a non-fast-forward push rejection.
 */
function isNonFastForwardRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("non-fast-forward") ||
    lower.includes("[rejected]") ||
    lower.includes("fetch first") ||
    (lower.includes("failed to push") && lower.includes("updates were rejected"))
  );
}
