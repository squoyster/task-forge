import { loadTaskById, clearTaskLock, appendAgentNote, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition, getAllowedTransitions } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logSub, logInfo, logDivider } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";
import { buildJsonTask } from "../util/json-result.js";

export interface BlockOptions {
  json?: boolean;
  category?: string;
  blockedBy?: string;
}

export async function cmdBlock(
  taskId: string,
  reason: string,
  options: BlockOptions = {},
): Promise<void> {
  const startTime = Date.now();
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    const result = failedResult({
      command: "block",
      error: `Task ${taskId} not found`,
      code: "TASK_NOT_FOUND",
      nextCommands: getValidNextCommands("block", "success"), // Or empty array
      duration: Date.now() - startTime,
    });

    if (options.json) {
      process.stdout.write(renderResultJson(result) + "\n");
    } else {
      throw new TaskNotFoundError(taskId);
    }
    return;
  }

  const transitionError = validateTransition(task.status, STATUS.BLOCKED);
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    const result = failedResult({
      command: "block",
      error: `Cannot transition from "${task.status}" to "${STATUS.BLOCKED}". Allowed: ${allowed.join(", ")}`,
      code: "INVALID_TRANSITION",
      nextCommands: getValidNextCommands("block", "success"), // Or derive from allowed transitions
      duration: Date.now() - startTime,
    });

    if (options.json) {
      process.stdout.write(renderResultJson(result) + "\n");
    } else {
      throw new InvalidStatusTransitionError(task.status, STATUS.BLOCKED, allowed);
    }
    return;
  }

  // Assert ownership if task is locked
  if (task.assignee) {
    await assertTaskOwnership(task, repoRoot);
  }

  // Re-read for writing additional fields
  const current = parseTaskFile(task.filePath);
  if (!current) {
    const result = failedResult({
      command: "block",
      error: `Task ${taskId} not found when reading for update`,
      code: "TASK_NOT_FOUND",
      nextCommands: getValidNextCommands("block", "success"),
      duration: Date.now() - startTime,
    });

    if (options.json) {
      process.stdout.write(renderResultJson(result) + "\n");
    } else {
      throw new TaskNotFoundError(taskId);
    }
    return;
  }

  current.status = STATUS.BLOCKED;
  current.blocked_reason = reason;
  current.block_category = (options.category as typeof current.block_category) ?? "unspecified";
  current.blocked_by = (options.blockedBy as typeof current.blocked_by) ?? "unspecified";
  current.blocked_since = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  writeTaskFile(current);

  // Clear the lock
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  const catLabel = options.category ? ` [${options.category}]` : "";
  appendAgentNote(task.filePath, today, "System", [
    `Task blocked${catLabel}: ${reason}`,
    options.blockedBy ? `Blocked by: ${options.blockedBy}` : "",
  ].filter(Boolean));

  // Push state changes to shared task-state branch
  await commitAndPushTaskState(repoRoot, `chore: block ${taskId} — ${reason}`);

  const result = successResult({
    command: "block",
    taskId,
    guidance: `Task ${taskId} is now blocked. Run 'taskforge next' to find the next available task, or 'taskforge resume <taskId>' to continue working on another in-progress task.`,
    nextCommands: getValidNextCommands("block", "success"),
    duration: Date.now() - startTime,
  });

  if (options.json) {
    const final = loadTaskById(taskId);
    const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
    jsonOutput.task = final ? buildJsonTask(final) : buildJsonTask(current);
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + "\n");
  } else {
    logSuccess(`Task ${taskId} blocked: ${reason}`);
    if (options.category && options.category !== "unspecified") {
      logSub(`  Category: ${options.category}`);
    }
    logDivider();
    logInfo("Next actions:");
    logSub("  taskforge next          — Find the next available task");
    logSub("  taskforge resume <id>   — Continue working on another in-progress task");
    process.stdout.write(renderResultMarkdown(result) + "\n");
  }
}