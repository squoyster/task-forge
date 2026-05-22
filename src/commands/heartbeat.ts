import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logInfo, logError } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import { STATUS } from "../util/status-constants.js";

export interface HeartbeatOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdHeartbeat(
  taskId: string,
  options: HeartbeatOptions = {},
): Promise<void> {
  const { force = false, json = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (task.status !== STATUS.IN_PROGRESS) {
    if (json) {
      printJson(jsonError(
        `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". Heartbeat is only valid for In Progress tasks.`,
        "INVALID_STATUS",
      ));
      return;
    }
    logError(
      `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". ` +
      `Heartbeat is only valid for In Progress tasks.`,
    );
    return;
  }

  if (!force && task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch (err) {
      if (json) {
        printJson(jsonError(
          `Task ${taskId} is assigned to session "${task.assignee}". Use --force to heartbeat anyway.`,
          "OWNERSHIP_MISMATCH",
        ));
        return;
      }
      throw err;
    }
  }

  const prevClaimedAt = task.claimed_at;

  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
  }

  const now = new Date();
  current.claimed_at = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  writeTaskFile(current);

  const today = now.toISOString().split("T")[0];
  const prevTime = prevClaimedAt
    ? `${prevClaimedAt}`
    : "unknown";
  const agoText = prevClaimedAt && typeof prevClaimedAt === "string"
    ? ` (reset from ${prevTime})`
    : "";

  appendAgentNote(current.filePath, today, "System", [
    `Heartbeat: lease renewed${force ? " (forced)" : ""}${agoText}`,
  ]);

  await commitAndPushTaskState(repoRoot, `chore: heartbeat ${taskId}`);

  if (json) {
    printJson(jsonOk({
      task: buildJsonTask(current),
    }));
    return;
  }

  logSuccess(`Heartbeat: task ${taskId} lease renewed.`);
  if (force) {
    logInfo(`  (forced — ownership not required)`);
  }
}
