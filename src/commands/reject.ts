import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";

export async function cmdReject(taskId: string, reason: string, options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
    else throw new TaskNotFoundError(taskId);
    return;
  }

  updateTaskStatus(task.filePath, STATUS.REJECTED);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [`Task rejected: ${reason}`]);

  await commitAndPushTaskState(repoRoot, `chore: reject ${taskId}`);

  if (options?.json) {
    const updated = loadTaskById(taskId);
    printJson(jsonOk({ task: updated ? buildJsonTask(updated) : buildJsonTask(task) }));
    return;
  }

  logSuccess(`Task ${taskId} rejected: ${reason}`);
}
