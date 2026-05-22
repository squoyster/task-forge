import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { validateTransition, getAllowedTransitions } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";

export interface BlockOptions {
  json?: boolean;
}

export async function cmdBlock(
  taskId: string,
  reason: string,
  options: BlockOptions = {},
): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options.json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  const transitionError = validateTransition(task.status, STATUS.BLOCKED);
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    if (options.json) {
      printJson(jsonError(
        `Cannot transition from "${task.status}" to "${STATUS.BLOCKED}". Allowed: ${allowed.join(", ")}`,
        "INVALID_TRANSITION",
      ));
      return;
    }
    throw new InvalidStatusTransitionError(task.status, STATUS.BLOCKED, allowed);
  }

  // Assert ownership if task is locked
  if (task.assignee) {
    await assertTaskOwnership(task, repoRoot);
  }

  updateTaskStatus(task.filePath, STATUS.BLOCKED);

  // Clear the lock
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task blocked: ${reason}`,
  ]);

  // Push state changes to shared task-state branch
  await commitAndPushTaskState(repoRoot, `chore: block ${taskId} — ${reason}`);

  if (options.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
    }));
    return;
  }

  logSuccess(`Task ${taskId} blocked: ${reason}`);
}