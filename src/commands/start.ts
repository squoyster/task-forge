import { loadTaskById, loadAllTasks, updateTaskStatus, updateTaskLock, appendAgentNote, clearTaskLock, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { createWorktree, jitteredPush } from "../core/git.js";
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

  // Create worktree and branch with session ID in the name
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title, sessionId);
  }

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

  // Set the lock
  updateTaskLock(task.filePath, sessionId);

  // Store control-file hash for change detection
  const current = parseTaskFile(task.filePath);
  if (current) {
    current.context_hash = hashControlFiles(repoRoot);
    writeTaskFile(current);
  }

  // Update status to In Progress if it was Ready
  if (task.status === STATUS.READY) {
    const transitionError = validateTransition(task.status, STATUS.IN_PROGRESS);
    if (transitionError) {
      throw new InvalidStatusTransitionError(
        task.status,
        STATUS.IN_PROGRESS,
        [STATUS.IN_PROGRESS],
      );
    }
    updateTaskStatus(task.filePath, STATUS.IN_PROGRESS);
    if (!options?.json) {
      logSuccess(`Status updated: ${STATUS.READY} → ${STATUS.IN_PROGRESS}`);
    }
  }

  // Append agent note
  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task started via taskforge start ${taskId}`,
    `Session: ${sessionId}`,
    `Branch: ${task.branch}`,
    `Worktree: ${task.worktree ?? "none"}`,
  ]);

  // Push state changes to shared task-state branch with jittered retry
  const pushed = await jitteredPush(repoRoot, `chore: start ${taskId} [session: ${sessionId}]`, {
    onConflict: async (_stateDir: string) => {
      // After rebase, re-read the task to check if another agent claimed it
      const currentTask = loadTaskById(taskId);
      if (!currentTask) {
        if (!options?.json) logWarn(`Task ${taskId} disappeared after rebase. Aborting.`);
        return false;
      }
      if (currentTask.assignee && currentTask.assignee !== sessionId) {
        if (!options?.json) {
          logWarn(
            `Another agent (session "${currentTask.assignee}") claimed ${taskId} while we were pushing. ` +
            `Abandoning claim.`,
          );
        }
        // Clear our local lock
        clearTaskLock(task.filePath);
        return false;
      }
      // Task is still ours — retry the push
      return true;
    },
  });

  if (!pushed) {
    if (options?.json) {
      printJson(jsonError(
        `Failed to push claim for ${taskId}. The task may have been claimed by another agent.`,
        "PUSH_FAILED",
      ));
      return;
    }
    logError(
      `Failed to push claim for ${taskId}. The task may have been claimed by another agent. ` +
      `Run 'taskforge next' to find another task.`,
    );
    return;
  }

  // Success — output JSON or human-readable
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