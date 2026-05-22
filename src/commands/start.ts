import { loadTaskById, loadAllTasks, updateTaskStatus, updateTaskLock, appendAgentNote, clearTaskLock, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { createWorktree } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { makeBranchName } from "../util/paths.js";
import { generateSessionId } from "../core/session.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { hashControlFiles } from "../core/control-files.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError, logHeader, logSub, logDivider } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError, WorktreeError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";

export interface StartOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdStart(taskId: string, options?: StartOptions): Promise<void> {
  const repoRoot = getRepoRoot();

  // Pull latest task-state and sweep before claiming
  await pullTaskState(repoRoot);
  await sweepStaleTasks(repoRoot, { commit: true });

  // Reload task after sweeping (it may have been reset to Ready)
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // Validate status
  if (task.status !== STATUS.READY && task.status !== STATUS.IN_PROGRESS) {
    if (options?.json) {
      printJson(jsonError(
        `Cannot start task with status "${task.status}". Must be "${STATUS.READY}" or "${STATUS.IN_PROGRESS}".`,
        "INVALID_STATUS",
      ));
      return;
    }
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.IN_PROGRESS,
      [STATUS.READY, STATUS.IN_PROGRESS],
    );
  }

  // Doctor-lock check
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    if (options?.json) {
      printJson(jsonError(`System is in doctor recovery mode: ${lock.reason}`, "DOCTOR_LOCKED"));
      return;
    }
    logWarn(`System is in doctor recovery mode: ${lock.reason}`);
    logInfo(`All agents are paused until recovery is complete.`);
    return;
  }

  // Hard guardrail: check outstanding session tasks (exclude current for resume)
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    if (options?.json) {
      printJson(jsonError(
        `You still own task ${outstanding}. Close it first with 'taskforge done ${outstanding}'.`,
        "OUTSTANDING_TASK",
      ));
      return;
    }
    logWarn(`You still own task ${outstanding}.`);
    logInfo(`Run 'taskforge done ${outstanding}' to mark it complete first.`);
    return;
  }

  // Lock check: if task is locked by another session, reject unless --force
  if (task.assignee && !options?.force) {
    if (options?.json) {
      printJson(jsonError(
        `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. Use --force to override.`,
        "NEEDS_FORCE",
      ));
      return;
    }
    logError(
      `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. ` +
      `Use --force to override (only if you are sure the claim is stale).`,
    );
    return;
  }

  // If --force, warn about overriding
  if (task.assignee && options?.force && !options?.json) {
    logWarn(`Overriding stale claim from session "${task.assignee}".`);
  }

  // Generate session ID
  const sessionId = generateSessionId();

  // --- Phase 1: Claim (durable — push before creating worktree) ---

  // Set branch name
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title, sessionId);
  }

  // Set the lock
  updateTaskLock(task.filePath, sessionId);

  // Store control-file hash
  const current = parseTaskFile(task.filePath);
  if (current) {
    current.context_hash = hashControlFiles(repoRoot);
    writeTaskFile(current);
  }

  // Update status to In Progress if it was Ready
  if (task.status === STATUS.READY) {
    const transitionError = validateTransition(task.status, STATUS.IN_PROGRESS);
    if (transitionError) {
      throw new InvalidStatusTransitionError(task.status, STATUS.IN_PROGRESS, [STATUS.IN_PROGRESS]);
    }
    updateTaskStatus(task.filePath, STATUS.IN_PROGRESS);
  }

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task claimed via taskforge start ${taskId}${options?.force ? " (forced)" : ""}`,
    `Session: ${sessionId}`,
    `Branch: ${task.branch}`,
  ]);

  // Push claim durably through transaction layer
  const pushed = await withTaskStateTransaction(
    { command: `claim ${taskId}`, maxRetries: 3 },
    async (tx) => {
      const fresh = tx.loadTask(taskId);
      if (!fresh) throw new Error("Task disappeared");
      if (fresh.assignee && fresh.assignee !== sessionId) throw new Error(`Claimed by ${fresh.assignee}`);
      tx.claimTask(taskId, sessionId);
      tx.appendNote(taskId, "System", [
        `Task claimed via taskforge start ${taskId}${options?.force ? " (forced)" : ""}`,
        `Session: ${sessionId}`,
        `Branch: ${task.branch}`,
      ]);
      return true;
    },
  ).catch(() => false);

  if (!pushed) {
    if (options?.json) {
      printJson(jsonError(`Failed to push claim for ${taskId}.`, "PUSH_FAILED"));
      return;
    }
    logError(`Failed to push claim for ${taskId}. The task may have been claimed by another agent.`);
    return;
  }

  // --- Phase 2: Workspace (only after claim is durably pushed) ---

  try {
    const result = await createWorktree(repoRoot, task);
    task.worktree = result.path;

    if (!options?.json) {
      if (result.created) {
        logSuccess(`Created worktree at: ${result.path}`);
        logSuccess(`Created branch: ${result.branch}`);
      } else {
        logInfo(`Worktree already exists at: ${result.path}`);
      }
    }
  } catch (err) {
    if (options?.json) {
      printJson(jsonError(
        `Could not create worktree: ${err instanceof Error ? err.message : String(err)}`,
        "WORKTREE_ERROR",
      ));
      return;
    }
    throw new WorktreeError(
      `Could not create worktree: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Record worktree metadata
  const updated = parseTaskFile(task.filePath);
  if (updated) {
    updated.worktree = task.worktree;
    writeTaskFile(updated);
  }

  appendAgentNote(task.filePath, today, "System", [
    `Worktree created: ${task.worktree}`,
  ]);

  // Push metadata update through transaction
  await withTaskStateTransaction(
    { command: `start ${taskId} [workspace]`, maxRetries: 2 },
    (tx) => {
      const t = tx.loadTask(taskId);
      if (t) {
        t.worktree = task.worktree;
        tx.updateTask(t);
        tx.appendNote(taskId, "System", [`Worktree created: ${task.worktree}`]);
      }
    },
  );

  // Success output
  if (options?.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
      workspace: {
        branch: task.branch,
        worktree: task.worktree ?? undefined,
      },
      next: {
        command: task.worktree ? `cd ${task.worktree}` : undefined,
      },
    }));
    return;
  }

  // Print agent instructions
  logDivider();
  logHeader(`## Task Started: ${taskId}`);
  logSub(`**Title:** ${taskId}`);
  logSub(`**Session:** ${sessionId}`);
  logSub(`**Branch:** ${task.branch}`);
  logSub(`**Worktree:** ${task.worktree ?? "not created"}`);
  logDivider();
  logHeader(`### Agent Instructions`);
  logDivider();
  logSub(`1. cd ${task.worktree ?? repoRoot}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read ${repoRoot}/AGENTS.md (if present)`);
  logSub(`4. Read ${task.filePath}`);
  logSub(`5. Work only on ${taskId}`);
  logSub(`6. Use the continuation policy from TASKFORGE.md`);
  logSub(`7. Do not stop unless a human-intervention condition occurs`);
  logSub(`8. Update task notes before ending`);
  logDivider();
  logHeader(`### Quick Start`);
  logDivider();
  logSub(`cd ${task.worktree ?? repoRoot}`);
  logSub(`opencode`);
}