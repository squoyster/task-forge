import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logSub, logDivider, logWarn, logSuccess, logInfo } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { STATUS } from "../util/status-constants.js";
import { readSessionState } from "../core/session-state.js";

interface RecoveryResult {
  taskId: string;
  sessionId: string;
  worktreePath: string;
  branch: string;
  method: "session-file" | "branch-match" | "dirty-worktree";
  claimedAt: string;
}

/**
 * Attempt recovery by reading the session state file in the worktree.
 */
function recoverBySessionFile(worktreePath: string): RecoveryResult | null {
  const state = readSessionState(worktreePath);
  if (!state) return null;

  return {
    taskId: state.task_id,
    sessionId: state.session_id,
    worktreePath: state.worktree_path,
    branch: "", // Will be resolved from task file
    method: "session-file",
    claimedAt: state.claimed_at,
  };
}

/**
 * Attempt recovery by scanning all In Progress tasks and matching branch session IDs.
 * Session IDs are embedded in branch names as: agent/TASK-ID-<short-desc>--<session-hash>
 */
function recoverByBranchMatch(): RecoveryResult | null {
  const tasks = loadAllTasks();
  const inProgress = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);

  for (const task of inProgress) {
    if (!task.branch) continue;

    // Extract session ID from branch name pattern: ...--<session-hash>
    const match = task.branch.match(/--([a-f0-9]{16})$/);
    if (!match) continue;

    const sessionId = match[1];
    const wtPath = getWorktreePath(getRepoRoot(), task.id);
    if (!fs.existsSync(wtPath)) continue;

    return {
      taskId: task.id,
      sessionId,
      worktreePath: wtPath,
      branch: task.branch,
      method: "branch-match",
      claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : (task.claimed_at?.toISOString() ?? ""),
    };
  }

  return null;
}

/**
 * Attempt recovery by finding dirty worktrees with uncommitted changes.
 */
function recoverByDirtyWorktree(): RecoveryResult | null {
  const tasks = loadAllTasks();

  for (const task of tasks) {
    if (!task.worktree || !fs.existsSync(task.worktree)) continue;

    // Check for session file first
    const sessionFile = path.join(task.worktree, ".taskforge-session.json");
    if (fs.existsSync(sessionFile)) {
      const state = readSessionState(task.worktree);
      if (state) {
        return {
          taskId: state.task_id,
          sessionId: state.session_id,
          worktreePath: task.worktree,
          branch: task.branch ?? "",
          method: "dirty-worktree",
          claimedAt: state.claimed_at,
        };
      }
    }

    // Fallback: check if worktree has uncommitted changes via git (sync)
    try {
      const stdout = execSync("git status --porcelain", { cwd: task.worktree, encoding: "utf-8" });
      if (stdout.trim()) {
        // Has uncommitted changes — try to extract task ID from branch
        const branchOut = execSync("git branch --show-current", { cwd: task.worktree, encoding: "utf-8" });
        const branchMatch = branchOut.match(/agent\/(TASK-\d+)-/);
        if (branchMatch) {
          return {
            taskId: branchMatch[1],
            sessionId: "",
            worktreePath: task.worktree,
            branch: branchOut.trim(),
            method: "dirty-worktree",
            claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : (task.claimed_at?.toISOString() ?? ""),
          };
        }
      }
    } catch {
      // Not a git repo or git command failed
    }
  }

  return null;
}

/**
 * Auto-detect recovery with fallback chain:
 * 1. Session file in worktree
 * 2. Branch session ID matching
 * 3. Dirty worktree fallback
 */
function autoDetectRecovery(taskId?: string): RecoveryResult | null {
  if (taskId) {
    // Specific task requested — try session file first
    const wtPath = getWorktreePath(getRepoRoot(), taskId);
    const byFile = recoverBySessionFile(wtPath);
    if (byFile) return byFile;

    // Fallback to branch match for this specific task
    const tasks = loadAllTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status === STATUS.IN_PROGRESS && task.branch) {
      const match = task.branch.match(/--([a-f0-9]{16})$/);
      if (match) {
        return {
          taskId: task.id,
          sessionId: match[1],
          worktreePath: getWorktreePath(getRepoRoot(), taskId),
          branch: task.branch,
          method: "branch-match",
          claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : (task.claimed_at?.toISOString() ?? ""),
        };
      }
    }

    // Fallback to dirty worktree
    if (task && task.worktree && fs.existsSync(task.worktree)) {
      return {
        taskId: task.id,
        sessionId: "",
        worktreePath: task.worktree,
        branch: task.branch ?? "",
        method: "dirty-worktree",
        claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : (task.claimed_at?.toISOString() ?? ""),
      };
    }

    return null;
  }

  // No specific task — try full auto-detect chain
  // 1. Scan all worktrees for session files
  const tasks = loadAllTasks();
  for (const task of tasks) {
    if (task.worktree && fs.existsSync(task.worktree)) {
      const byFile = recoverBySessionFile(task.worktree);
      if (byFile) return byFile;
    }
  }

  // 2. Branch session ID matching
  const byBranch = recoverByBranchMatch();
  if (byBranch) return byBranch;

  // 3. Dirty worktree fallback
  const byDirty = recoverByDirtyWorktree();
  if (byDirty) return byDirty;

  return null;
}

export async function cmdResume(taskId?: string, options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();

  // Auto-detect recovery
  const recovery = autoDetectRecovery(taskId);

  if (!recovery) {
    if (options?.json) {
      printJson(jsonError(
        "No recoverable session found",
        "NO_RECOVERABLE_SESSION",
        { nextActions: ["next", "claim"], guidance: "No active sessions found. Use 'taskforge next' to find a task, or 'taskforge claim' to claim one." },
      ));
    } else {
      logWarn("No recoverable session found.");
      logDivider();
      logInfo("Next actions:");
      logSub("  taskforge next            — Find the next available task");
      logSub("  taskforge claim <TASK-ID> — Claim a task");
    }
    return;
  }

  // Load the task to get full details
  const task = loadTaskById(recovery.taskId);
  if (!task) {
    if (options?.json) printJson(jsonError(`Task ${recovery.taskId} not found`, "TASK_NOT_FOUND"));
    else throw new TaskNotFoundError(recovery.taskId);
    return;
  }

  if (options?.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
      workspace: { branch: recovery.branch || task.branch, worktree: recovery.worktreePath, exists: true },
      recovery: {
        method: recovery.method,
        sessionId: recovery.sessionId,
        claimedAt: recovery.claimedAt,
      },
      nextActions: ["work", "checkpoint", "done"],
      guidance: `Resume working in ${recovery.worktreePath}. Use 'taskforge checkpoint ${recovery.taskId}' to save progress, or 'taskforge done ${recovery.taskId}' when complete.`,
    }));
    return;
  }

  logHeader(`## Session Recovered: ${recovery.taskId}`);
  logSub(`**Method:** ${recovery.method}`);
  logSub(`**Worktree:** ${recovery.worktreePath}`);
  logSub(`**Branch:** ${recovery.branch || task.branch || "none"}`);
  logSub(`**Session ID:** ${recovery.sessionId || "unknown"}`);
  logSub(`**Claimed At:** ${recovery.claimedAt || "unknown"}`);
  logDivider();
  logHeader("### Agent Instructions");
  logDivider();
  logSub(`1. cd ${recovery.worktreePath}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read the task file at ../task-state/${recovery.taskId}.md`);
  logSub(`4. Continue work on ${recovery.taskId}`);
  logSub(`5. Use 'taskforge checkpoint ${recovery.taskId}' to save progress`);
  logSub(`6. Use 'taskforge done ${recovery.taskId}' when complete`);
  logDivider();
  logSuccess(`Ready to resume ${recovery.taskId}.`);
}
