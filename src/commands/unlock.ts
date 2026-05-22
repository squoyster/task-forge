import { loadTaskById, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logError } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";

export interface UnlockOptions {
  force?: boolean;
}

export async function cmdUnlock(
  taskId: string,
  options: UnlockOptions = {},
): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  if (!task.lockedBy) {
    logWarn(`Task ${taskId} is not locked.`);
    return;
  }

  if (!options.force) {
    logError(
      `Task ${taskId} is locked by session "${task.lockedBy}" since ${task.lockedAt ?? "unknown"}. ` +
      `Use --force to unlock.`,
    );
    return;
  }

  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task unlocked (forced) — previous lock was held by session "${task.lockedBy}"`,
  ]);

  logSuccess(`Task ${taskId} unlocked. Lock from session "${task.lockedBy}" has been cleared.`);

  // Push state changes to shared task-state branch
  await commitAndPushTaskState(repoRoot, `chore: unlock ${taskId}`);
}
