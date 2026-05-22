import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { validateTransition, getAllowedTransitions } from "../core/status-transition.js";
import { logSuccess } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";

export async function cmdBlock(taskId: string, reason: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  const transitionError = validateTransition(task.status, "Blocked");
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    throw new InvalidStatusTransitionError(task.status, "Blocked", allowed);
  }

  // Assert ownership if task is locked
  if (task.lockedBy) {
    await assertTaskOwnership(task, repoRoot);
  }

  updateTaskStatus(task.filePath, "Blocked");

  // Clear the lock
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task blocked: ${reason}`,
  ]);

  logSuccess(`Task ${taskId} blocked: ${reason}`);
}
