import { loadTaskById, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logError } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";

export interface UnlockOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdUnlock(
  taskId: string,
  options: UnlockOptions = {},
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

  if (!task.assignee) {
    if (options.json) {
      printJson(jsonOk({
        task: buildJsonTask(task),
      }));
      return;
    }
    logWarn(`Task ${taskId} is not claimed.`);
    return;
  }

  if (!options.force) {
    if (options.json) {
      printJson(jsonError(
        `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. Use --force to unlock.`,
        "NEEDS_FORCE",
      ));
      return;
    }
    logError(
      `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. ` +
      `Use --force to unlock.`,
    );
    return;
  }

  const previousAssignee = task.assignee;
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task unlocked (forced) — previous claim was held by session "${previousAssignee}"`,
  ]);

  // Push state changes
  await commitAndPushTaskState(repoRoot, `chore: unlock ${taskId}`);

  if (options.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
    }));
    return;
  }

  logSuccess(`Task ${taskId} unlocked. Claim from session "${previousAssignee}" has been cleared.`);
}