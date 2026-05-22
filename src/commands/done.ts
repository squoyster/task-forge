import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { logSuccess } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";

export async function cmdDone(taskId: string, force = false): Promise<void> {
  const task = loadTaskById(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  const transitionError = validateTransition(task.status, "Done");
  if (transitionError && !force) {
    throw new InvalidStatusTransitionError(
      task.status,
      "Done",
      ["Review", "Verify"],
    );
  }

  updateTaskStatus(task.filePath, "Done");

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task marked Done${force ? " (forced)" : ""}`,
  ]);

  logSuccess(`Task ${taskId} marked as Done.`);
}
