import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logError } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";

export interface ReleaseOptions {
  json?: boolean;
}

export async function cmdRelease(taskId: string, options?: ReleaseOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
    else throw new TaskNotFoundError(taskId);
    return;
  }

  if (!task.assignee) {
    if (options?.json) printJson(jsonOk({ task: buildJsonTask(task) }));
    else logInfo(`Task ${taskId} is not claimed — nothing to release.`);
    return;
  }

  const previousAssignee = task.assignee;
  const wasInProgress = task.status === STATUS.IN_PROGRESS;

  // Assert ownership (no --force — release is voluntary)
  await assertTaskOwnership(task, repoRoot);

  clearTaskLock(task.filePath);

  if (wasInProgress) {
    updateTaskStatus(task.filePath, STATUS.READY);
  }

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task released by session "${previousAssignee}"${wasInProgress ? " — reset to Ready" : ""}`,
  ]);

  await commitAndPushTaskState(repoRoot, `chore: release ${taskId}`);

  if (options?.json) {
    const updated = loadTaskById(taskId);
    printJson(jsonOk({ task: updated ? buildJsonTask(updated) : buildJsonTask(task) }));
    return;
  }

  logSuccess(`Task ${taskId} released.${wasInProgress ? " Status reset to Ready." : ""}`);
}