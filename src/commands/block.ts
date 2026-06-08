import { loadTaskById, clearTaskLock, appendAgentNote, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition, getAllowedTransitions } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logSub, logInfo, logDivider } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";

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
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options.json) {
      writeResult(failedResult({ command: "block", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  const transitionError = validateTransition(task.status, STATUS.BLOCKED);
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    if (options.json) {
      const nextCommands = (allowed.includes("Done") ? ["done"] : ["start"]).map(cmd => ({
        command: `taskforge ${cmd}${cmd === "done" ? ` ${taskId}` : ""}`,
        purpose: cmd === "done" ? "Mark the task as Done" : "Start the task",
        when: "after invalid transition attempt",
        allowedFor: "all" as const,
        priority: 1 as const,
      }));
      writeResult(failedResult({
        command: "block",
        taskId,
        error: `Cannot transition from "${task.status}" to "${STATUS.BLOCKED}". Allowed: ${allowed.join(", ")}`,
        code: "INVALID_TRANSITION",
        nextCommands,
      }), options.json);
      return;
    }
    throw new InvalidStatusTransitionError(task.status, STATUS.BLOCKED, allowed);
  }

  // Assert ownership if task is locked
  if (task.assignee) {
    await assertTaskOwnership(task, repoRoot);
  }

  // Re-read for writing additional fields
  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
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

  if (options.json) {
    writeResult(successResult({
      command: "block",
      taskId,
      guidance: `Task ${taskId} is now blocked. Run 'taskforge next' to find the next available task, or 'taskforge resume <taskId>' to continue working on another in-progress task.`,
      nextCommands: [
        { command: "taskforge next", purpose: "Find the next available task", when: "after blocking task", allowedFor: "all", priority: 1 },
        { command: `taskforge resume ${taskId}`, purpose: "Continue working on another in-progress task", when: "after blocking task", allowedFor: "all", priority: 2 },
      ],
    }), options.json);
    return;
  }

  logSuccess(`Task ${taskId} blocked: ${reason}`);
  if (options.category && options.category !== "unspecified") {
    logSub(`  Category: ${options.category}`);
  }
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next          — Find the next available task");
  logSub("  taskforge resume <id>   — Continue working on another in-progress task");
}