import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { logSuccess, logError, logInfo } from "../util/logging.js";

export async function cmdBlock(taskId: string, reason: string): Promise<void> {
  const task = loadTaskById(taskId);

  if (!task) {
    logError(`Task ${taskId} not found.`);
    process.exit(1);
  }

  const transitionError = validateTransition(task.status, "Blocked");
  if (transitionError) {
    logError(transitionError);
    process.exit(1);
  }

  updateTaskStatus(task.filePath, "Blocked");

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task blocked: ${reason}`,
  ]);

  logSuccess(`Task ${taskId} blocked: ${reason}`);
}
