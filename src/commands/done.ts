import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { logSuccess, logError, logInfo } from "../util/logging.js";

export async function cmdDone(taskId: string, force = false): Promise<void> {
  const task = loadTaskById(taskId);

  if (!task) {
    logError(`Task ${taskId} not found.`);
    process.exit(1);
  }

  const transitionError = validateTransition(task.status, "Done");
  if (transitionError && !force) {
    logError(transitionError);
    logInfo("Use --force to override.");
    process.exit(1);
  }

  updateTaskStatus(task.filePath, "Done");

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task marked Done${force ? " (forced)" : ""}`,
  ]);

  logSuccess(`Task ${taskId} marked as Done.`);
}
