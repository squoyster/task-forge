import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { validateTransition, getAllowedTransitions } from "../core/status-transition.js";
import { logSuccess } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";

export async function cmdBlock(taskId: string, reason: string): Promise<void> {
  const task = loadTaskById(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  const transitionError = validateTransition(task.status, "Blocked");
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    throw new InvalidStatusTransitionError(task.status, "Blocked", allowed);
  }

  updateTaskStatus(task.filePath, "Blocked");

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task blocked: ${reason}`,
  ]);

  logSuccess(`Task ${taskId} blocked: ${reason}`);
}
