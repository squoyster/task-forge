import {
  getRepoRoot,
  getTaskStateDir,
  getWorktreePath,
  makeBranchName
} from "./chunk-46G2ACH2.js";
import {
  logWarn
} from "./chunk-OPCWHN3N.js";

// src/core/git.ts
import simpleGit from "simple-git";
import { execa } from "execa";
async function checkUncommittedWorktrees(repoRoot, tasks) {
  const git = simpleGit(repoRoot);
  const worktrees = await git.raw("worktree", "list", "--porcelain");
  const results = [];
  const lines = worktrees.split("\n");
  let currentWorktree = null;
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
              worktreePath: currentWorktree.path
            });
          }
        }
      }
      currentWorktree = { path: line.slice(9), branch: "" };
    } else if (line.startsWith("branch ") && currentWorktree) {
      currentWorktree.branch = line.slice(7);
    }
  }
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
          worktreePath: currentWorktree.path
        });
      }
    }
  }
  return results;
}
async function checkWorktreeDirty(worktreePath) {
  try {
    const git = simpleGit(worktreePath);
    const status = await git.status();
    return status.files.length;
  } catch {
    return 0;
  }
}
async function getWorktreeDirtyFiles(worktreePath) {
  try {
    const git = simpleGit(worktreePath);
    const status = await git.status();
    return status.files.map((f) => f.path);
  } catch {
    return [];
  }
}
async function getBranchCommitsAhead(repoRoot, branch) {
  try {
    const remoteBranch = `origin/${branch.replace(/^refs\/heads\//, "")}`;
    const result = await execa("git", ["rev-list", "--count", `${remoteBranch}..HEAD`], { cwd: repoRoot });
    return parseInt(result.stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
function findTaskByWorktree(tasks, worktreePath) {
  for (const t of tasks) {
    if (t.worktree === worktreePath) return t;
  }
  const match = worktreePath.match(/worktrees[/\\][^/\\]+[/\\](TASK-\d+)/);
  if (match) {
    return tasks.find((t) => t.id === match[1]) ?? null;
  }
  return null;
}
async function createWorktree(repoRoot, task) {
  const git = simpleGit(repoRoot);
  const worktreePath = getWorktreePath(repoRoot, task.id);
  const branchName = task.branch ?? makeBranchName(task.id, extractTitle(task));
  const worktrees = await git.raw("worktree", "list", "--porcelain");
  if (worktrees.includes(worktreePath)) {
    return { path: worktreePath, branch: branchName, created: false };
  }
  const branches = await git.branchLocal();
  const branchExists = branches.all.includes(branchName);
  if (branchExists) {
    await execa("git", ["worktree", "add", worktreePath, branchName], {
      cwd: repoRoot
    });
  } else {
    await execa("git", ["worktree", "add", worktreePath, "-b", branchName], {
      cwd: repoRoot
    });
  }
  return { path: worktreePath, branch: branchName, created: true };
}
async function removeWorktree(repoRoot, taskId) {
  const worktreePath = getWorktreePath(repoRoot, taskId);
  const git = simpleGit(repoRoot);
  const worktrees = await git.raw("worktree", "list", "--porcelain");
  if (!worktrees.includes(worktreePath)) {
    return false;
  }
  await execa("git", ["worktree", "remove", worktreePath], { cwd: repoRoot });
  return true;
}
async function removeBranch(repoRoot, branchName, deleteRemote = false) {
  const git = simpleGit(repoRoot);
  const branches = await git.branchLocal();
  const branchExists = branches.all.includes(branchName);
  if (!branchExists) {
    return false;
  }
  const current = await git.branch();
  if (current.current === branchName) {
    await git.checkout("main");
  }
  await git.deleteLocalBranch(branchName, true);
  if (deleteRemote) {
    try {
      await execa("git", ["push", "origin", "--delete", branchName], {
        cwd: repoRoot
      });
    } catch {
    }
  }
  return true;
}
async function listWorktrees(repoRoot) {
  const git = simpleGit(repoRoot);
  const output = await git.raw("worktree", "list", "--porcelain");
  const results = [];
  let current = {};
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) results.push(current);
      current = { path: line.slice(9) };
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7);
    } else if (line.startsWith("HEAD ")) {
      current.commit = line.slice(5);
    }
  }
  if (current.path) results.push(current);
  return results;
}
async function getCurrentBranch(repoRoot) {
  const git = simpleGit(repoRoot);
  const branch = await git.branch();
  return branch.current;
}
async function commitChanges(worktreePath, message) {
  const git = simpleGit(worktreePath);
  await git.add(".");
  const status = await git.status();
  if (status.files.length > 0) {
    await git.commit(message);
  }
}
async function ensureTaskStateBranch(repoRoot) {
  const stateDir = getTaskStateDir(repoRoot);
  try {
    const git = simpleGit(repoRoot);
    const worktrees = await git.raw("worktree", "list", "--porcelain");
    if (worktrees.includes(stateDir)) {
      return stateDir;
    }
    const branches = await git.branchLocal();
    const localExists = branches.all.includes("task-state");
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
      await execa("git", ["worktree", "add", stateDir, "-b", "task-state"], { cwd: repoRoot });
      try {
        const wtGit = simpleGit(stateDir);
        await wtGit.raw("rm", "-rf", ".");
        const fs = await import("fs");
        const path = await import("path");
        fs.writeFileSync(
          path.join(stateDir, ".gitkeep"),
          "Task state branch \u2014 contains only task Markdown files.\n",
          "utf-8"
        );
        await wtGit.add(".");
        await wtGit.commit("chore: initialize task-state branch");
        await execa("git", ["push", "-u", "origin", "task-state"], { cwd: stateDir });
      } catch {
      }
    }
  } catch {
    const fs = await import("fs");
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
  }
  return stateDir;
}
async function commitAndPushTaskState(repoRoot, message) {
  const stateDir = getTaskStateDir(repoRoot);
  const fs = await import("fs");
  if (!fs.existsSync(stateDir)) {
    return;
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
    }
  } catch {
  }
}
async function pullTaskState(repoRoot) {
  const root = repoRoot ?? getRepoRoot();
  const stateDir = getTaskStateDir(root);
  const fs = await import("fs");
  if (!fs.existsSync(stateDir)) return;
  try {
    await execa("git", ["pull", "--rebase", "origin", "task-state"], { cwd: stateDir });
  } catch {
  }
}
function extractTitle(task) {
  const match = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  if (match) return match[1];
  return task.id;
}
async function jitteredPush(repoRoot, message, options) {
  const stateDir = getTaskStateDir(repoRoot);
  const fs = await import("fs");
  if (!fs.existsSync(stateDir)) {
    return true;
  }
  const maxRetries = options?.maxRetries ?? 3;
  const jitterMin = options?.jitterMinMs ?? 2e3;
  const jitterMax = options?.jitterMaxMs ?? 1e4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const git = simpleGit(stateDir);
      await git.add(".");
      const status = await git.status();
      if (status.files.length > 0) {
        await git.commit(message);
      }
      await execa("git", ["push", "origin", "task-state"], { cwd: stateDir });
      return true;
    } catch (err) {
      if (attempt >= maxRetries) {
        logWarn(`jitteredPush: exhausted ${maxRetries} retries for push to task-state`);
        return false;
      }
      if (!isNonFastForwardRejection(err)) {
        logWarn(`jitteredPush: push failed with unrecoverable error, skipping retry`);
        return false;
      }
      try {
        await execa("git", ["pull", "--rebase", "origin", "task-state"], { cwd: stateDir });
      } catch {
        logWarn(`jitteredPush: git pull --rebase failed, aborting retry`);
        return false;
      }
      const delay = jitterMin + Math.floor(Math.random() * (jitterMax - jitterMin + 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (options?.onConflict) {
        const shouldContinue = await options.onConflict(stateDir);
        if (!shouldContinue) {
          return false;
        }
      }
    }
  }
  return false;
}
function isNonFastForwardRejection(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return lower.includes("non-fast-forward") || lower.includes("[rejected]") || lower.includes("fetch first") || lower.includes("failed to push") && lower.includes("updates were rejected");
}

export {
  checkUncommittedWorktrees,
  getWorktreeDirtyFiles,
  getBranchCommitsAhead,
  createWorktree,
  removeWorktree,
  removeBranch,
  listWorktrees,
  getCurrentBranch,
  commitChanges,
  ensureTaskStateBranch,
  commitAndPushTaskState,
  pullTaskState,
  jitteredPush
};
//# sourceMappingURL=chunk-4P6LV6YT.js.map