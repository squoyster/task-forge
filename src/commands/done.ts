import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { removeWorktree, removeBranch, commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logWarn, logSub } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import { cmdGates } from "./gates.js";
import { isDoctorLocked, removeDoctorLock } from "../core/doctor-lock.js";
import { hashControlFiles } from "../core/control-files.js";
import type { ParsedTask } from "../core/task-store.js";

export interface DoneOptions {
  force?: boolean;
  forceGates?: boolean;
  forceTransition?: boolean;
  forceOwnership?: boolean;
  cleanup?: boolean;
  deleteBranch?: boolean;
  json?: boolean;
}

export async function cmdDone(
  taskId: string,
  options: DoneOptions = {},
): Promise<void> {
  const { force = false, forceGates = false, forceTransition = false, forceOwnership = false, cleanup = false, deleteBranch = false, json = false } = options;
  const skipGates = force || forceGates;
  const skipTransition = force || forceTransition;
  const skipOwnership = force || forceOwnership;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // --- Check gates ---
  const gatesPassed = await cmdGates({ json: options.json });
  if (!gatesPassed && !skipGates) {
  if (transitionError && !skipTransition) {
  if (task.assignee && !skipOwnership) {
  if (task.context_hash && !skipTransition) {
    const currentHash = hashControlFiles(repoRoot);
    if (currentHash !== task.context_hash) {
      if (json) {
        printJson(jsonError(
          "Control files have changed since task was started. Review changes before marking Done. Use --force to override.",
          "CONTEXT_CHANGED",
        ));
        return;
      }
      throw new Error(
        "Control files have changed since this task was started. " +
        "Review the changes before marking Done, or use --force to override.",
      );
    }
  }

  updateTaskStatus(task.filePath, STATUS.DONE);

  // Clear the lock
  clearTaskLock(task.filePath);

const today = new Date().toISOString().split("T")[0];
  const notes: string[] = [
    `Task marked Done${force ? " (forced)" : ""}`,
    !gatesPassed && force ? "Completed despite gate failures — forced." : "",
  ].filter(Boolean);

  if (json) {
    // In JSON mode, output the done result (gates may have been forced)
    printJson(jsonOk({
      task: buildJsonTask(task),
      ...(!gatesPassed && force ? { warning: "Gates failed but overridden with --force" } : {}),
    }));
    return;
  }

  // Auto-remove doctor lock if completing a recovery task
  if (isDoctorLocked(repoRoot).locked) {
    removeDoctorLock(repoRoot);
    if (!json) logInfo("Doctor lock removed — recovery task completed.");
  }

  logSuccess(`Task ${taskId} marked as Done.`);

  // --- Cleanup: remove worktree ---
  if (cleanup) {
    await performCleanup(repoRoot, task, deleteBranch, today, notes);
  }

  appendAgentNote(task.filePath, today, "System", notes);

  // Push state changes
  await commitAndPushTaskState(repoRoot, `chore: done ${taskId}`);

  if (json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
    }));
  }
}

async function performCleanup(
  repoRoot: string,
  task: ParsedTask,
  deleteBranch: boolean,
  today: string,
  notes: string[],
): Promise<void> {
  const hadWorktreeField = !!(task.worktree || task.branch);

  // 1. Remove worktree
  if (task.worktree) {
    try {
      const removed = await removeWorktree(repoRoot, task.id);
      if (removed) {
        logSub(`Worktree removed: ${task.worktree}`);
        notes.push(`Worktree removed: ${task.worktree}`);
      } else {
        logInfo(`Worktree not found (already cleaned up): ${task.worktree}`);
        notes.push(`Worktree not found (already cleaned up): ${task.worktree}`);
      }
    } catch (err) {
      const msg = `Failed to remove worktree: ${err instanceof Error ? err.message : String(err)}`;
      logWarn(msg);
      notes.push(msg);
    }
  } else if (hadWorktreeField) {
    logInfo("No worktree path recorded in task — skipping worktree removal.");
  }

  // 2. Delete branch
  if (deleteBranch && task.branch) {
    try {
      const deleted = await removeBranch(repoRoot, task.branch);
      if (deleted) {
        logSub(`Branch deleted: ${task.branch}`);
        notes.push(`Branch deleted: ${task.branch}`);
      } else {
        logInfo(`Branch not found (already deleted): ${task.branch}`);
        notes.push(`Branch not found (already deleted): ${task.branch}`);
      }
    } catch (err) {
      const msg = `Failed to delete branch: ${err instanceof Error ? err.message : String(err)}`;
      logWarn(msg);
      notes.push(msg);
    }
  } else if (deleteBranch && !task.branch) {
    logInfo("No branch recorded in task — skipping branch deletion.");
  }

  // 3. Clear worktree/branch from frontmatter
  if (hadWorktreeField) {
    const current = parseTaskFile(task.filePath);
    if (current) {
      current.worktree = undefined;
      current.branch = undefined;
      writeTaskFile(current);
      logSub("Worktree and branch fields cleared from task frontmatter.");
      notes.push("Worktree and branch fields cleared from task frontmatter.");
    }
  }
}