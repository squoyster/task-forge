import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logSub, logDivider, logWarn, logSuccess, logInfo } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { checkWorktreeBehindMain } from "../core/git.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { STATUS } from "../util/status-constants.js";
import { readSessionState } from "../core/session-state.js";
import { formatTimestampMarkdown, parseTimestamp } from "../util/timestamp.js";

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
    const tasks = loadAllTasks();
    const task = tasks.find((t) => t.id === taskId);

    // 1. Task-state recorded worktree path (set by start or claim) — most reliable
    if (task && task.worktree && fs.existsSync(task.worktree)) {
      const byFile = recoverBySessionFile(task.worktree);
      if (byFile) return byFile;
      // Even without session file, the worktree path is valid
      return {
        taskId: task.id,
        sessionId: "",
        worktreePath: task.worktree,
        branch: task.branch ?? "",
        method: "dirty-worktree",
        claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : (task.claimed_at?.toISOString() ?? ""),
      };
    }

    // 2. Computed path with session file (pre-start migration)
    const wtPath = getWorktreePath(getRepoRoot(), taskId);
    const byFile = recoverBySessionFile(wtPath);
    if (byFile) return byFile;

    // 3. Branch session ID matching (no worktree path recorded yet)
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

    // 4. Fallback: computed path exists as a dirty worktree
    const computedPath = getWorktreePath(getRepoRoot(), taskId);
    if (fs.existsSync(computedPath)) {
      return {
        taskId,
        sessionId: "",
        worktreePath: computedPath,
        branch: task?.branch ?? "",
        method: "dirty-worktree",
        claimedAt: typeof task?.claimed_at === "string" ? task.claimed_at : (task?.claimed_at?.toISOString() ?? ""),
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
      writeResult(failedResult({
        command: "resume",
        error: "No recoverable session found",
        code: "NO_RECOVERABLE_SESSION",
        guidance: "No active sessions found. Use 'taskforge next' to find a task, or 'taskforge claim' to claim one.",
        nextCommands: [
          { command: "taskforge next", purpose: "Find the next available task", when: "no active sessions", allowedFor: "all", priority: 1 },
          { command: "taskforge claim <TASK-ID>", purpose: "Claim a task", when: "no active sessions", allowedFor: "all", priority: 2 },
        ],
      }), options.json);
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
    if (options?.json) writeResult(failedResult({ command: "resume", taskId: recovery.taskId, error: `Task ${recovery.taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
    else throw new TaskNotFoundError(recovery.taskId);
    return;
  }

  if (options?.json) {
    writeResult(successResult({
      command: "resume",
      taskId: recovery.taskId,
      worktree: recovery.worktreePath,
      branch: recovery.branch || task.branch,
      guidance: `Resume working in ${recovery.worktreePath}. Use 'taskforge checkpoint ${recovery.taskId}' to save progress, or 'taskforge done ${recovery.taskId}' when complete.`,
      nextCommands: [
        { command: "work", purpose: "Continue working in the worktree", when: "after resume", allowedFor: "all", priority: 1 },
        { command: `taskforge checkpoint ${recovery.taskId}`, purpose: "Save progress", when: "after resume", allowedFor: "all", priority: 2 },
        { command: `taskforge done ${recovery.taskId}`, purpose: "Complete the task", when: "after resume", allowedFor: "all", priority: 3 },
      ],
    }), options.json);
    return;
  }

  logHeader(`## Session Recovered: ${recovery.taskId}`);
  logSub(`**Method:** ${recovery.method}`);
  logSub(`**Worktree:** ${recovery.worktreePath}`);
  logSub(`**Branch:** ${recovery.branch || task.branch || "none"}`);
  logSub(`**Session ID:** ${recovery.sessionId || "unknown"}`);
  const claimedAtDisplay = recovery.claimedAt
    ? (formatTimestampMarkdown(parseTimestamp(recovery.claimedAt)) || recovery.claimedAt)
    : "unknown";
  logSub(`**Claimed At:** ${claimedAtDisplay}`);
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

  // Warn if worktree branch is behind origin/main
  const branchToCheck = recovery.branch || task.branch || "";
  if (branchToCheck && recovery.worktreePath) {
    const behindStatus = await checkWorktreeBehindMain(repoRoot, recovery.worktreePath, branchToCheck);
    if (behindStatus.behind) {
      logWarn(
        `\n⚠️  Worktree branch is ${behindStatus.count} commit(s) behind origin/main. ` +
        `Run 'taskforge gates --json' then pull latest before continuing with new work.`
      );
    }
  }
}
