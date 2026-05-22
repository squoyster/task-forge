import simpleGit from "simple-git";
import { execa } from "execa";
import { getWorktreePath, makeBranchName } from "../util/paths.js";
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

function extractTitle(task: ParsedTask): string {
  // Try to extract title from body first line: # TASK-123: Title
  const match = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  if (match) return match[1];
  return task.id;
}
