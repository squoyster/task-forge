import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { removeWorktree, removeBranch, commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logWarn, logSub } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";
import type { ParsedTask } from "../core/task-store.js";

export interface DoneOptions {
  force?: boolean;
  cleanup?: boolean;
  deleteBranch?: boolean;
}

export async function cmdDone(
  taskId: string,
  options: DoneOptions = {},
): Promise<void> {
  const { force = false, cleanup = false, deleteBranch = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  // --- Status transition ---
  const transitionError = validateTransition(task.status, STATUS.DONE);
  if (transitionError && !force) {
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.DONE,
      [STATUS.REVIEW, STATUS.VERIFY],
    );
  }

  // Assert ownership if task is locked (skip if no lock set)
  if (task.assignee) {
    await assertTaskOwnership(task, repoRoot);
  }

  updateTaskStatus(task.filePath, STATUS.DONE);

  // Clear the lock
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  const notes: string[] = [`Task marked Done${force ? " (forced)" : ""}`];

  logSuccess(`Task ${taskId} marked as Done.`);

  // --- Cleanup: remove worktree ---
  if (cleanup) {
    await performCleanup(repoRoot, task, deleteBranch, today, notes);
  }

  appendAgentNote(task.filePath, today, "System", notes);

  // Push state changes to shared task-state branch
  await commitAndPushTaskState(repoRoot, `chore: done ${taskId}`);
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
