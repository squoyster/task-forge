import simpleGit from "simple-git";
import { execa } from "execa";
import { getWorktreePath, makeBranchName, getTaskStateDir } from "../util/paths.js";
import type { ParsedTask } from "./task-store.js";

export interface WorktreeResult {
  path: string;
  branch: string;
  created: boolean;
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

function extractTitle(task: ParsedTask): string {
  // Try to extract title from body first line: # TASK-123: Title
  const match = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  if (match) return match[1];
  return task.id;
}
