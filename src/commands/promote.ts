/**
 * `taskforge promote` — advance a task through the status state machine.
 *
 * Bridges the gap between `In Progress` and `Done` by exposing the
 * intermediate status transitions via CLI.
 *
 * Subcommands:
 *   promote TASK-ID            — Advance one step forward along the default path
 *   promote TASK-ID --to <s>   — Advance to a specific allowed status
 */
import { loadTaskById, parseTaskFile, writeTaskFile } from "../core/task-store.js";
import { validateTransition, getAllowedTransitions } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS, normalizeStatus, ALL_STATUSES } from "../util/status-constants.js";
import { logSuccess, logSub, logError, logDivider } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";

export interface PromoteOptions {
  to?: string;
  json?: boolean;
}

/**
 * Default forward path for status promotion.
 * Key = current status, Value = next forward status.
 * Skips Blocked, Deferred, and rollback transitions.
 */
const DEFAULT_FORWARD_PATH: Record<string, string> = {
  [STATUS.INBOX]: STATUS.NEEDS_SPEC,
  [STATUS.NEEDS_SPEC]: STATUS.READY,
  [STATUS.READY]: STATUS.IN_PROGRESS,
  [STATUS.IN_PROGRESS]: STATUS.IMPLEMENTATION_COMPLETE,
  [STATUS.IMPLEMENTATION_COMPLETE]: STATUS.SUBMITTED,
  [STATUS.SUBMITTED]: STATUS.REVIEW,
  [STATUS.REVIEW]: STATUS.MERGE_READY,
  [STATUS.MERGE_READY]: STATUS.VERIFY,
  [STATUS.VERIFY]: STATUS.DONE,
};

/**
 * Resolve the target status for promotion.
 *
 * If `--to` is provided, validate it's a known status.
 * If not provided, use the default forward path.
 */
function resolveTargetStatus(
  currentStatus: string,
  toFlag?: string,
): { target: string; isDefault: boolean } | { error: string } {
  if (toFlag) {
    const normalized = normalizeStatus(toFlag);
    if (!ALL_STATUSES.includes(normalized)) {
      return { error: `Unknown status: "${toFlag}". Valid statuses: ${ALL_STATUSES.join(", ")}` };
    }
    return { target: normalized, isDefault: false };
  }

  const defaultNext = DEFAULT_FORWARD_PATH[currentStatus];
  if (!defaultNext) {
    const allowed = getAllowedTransitions(currentStatus);
    if (allowed.length === 0) {
      return { error: `Task is in terminal status "${currentStatus}" — no forward transitions available.` };
    }
    // Pick the first non-rollback, non-lateral transition
    const forward = allowed.find((s) =>
      s !== STATUS.BLOCKED && s !== STATUS.DEFERRED && s !== STATUS.IN_PROGRESS
    );
    if (forward) {
      return { target: forward, isDefault: true };
    }
    return { error: `No forward transition available from "${currentStatus}". Allowed: ${allowed.join(", ")}` };
  }

  return { target: defaultNext, isDefault: true };
}

export async function cmdPromote(
  taskId: string,
  options: PromoteOptions = {},
): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options.json) {
      writeResult(failedResult({ command: "promote", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // Resolve target status
  const resolved = resolveTargetStatus(task.status, options.to);
  if ("error" in resolved) {
    if (options.json) {
      writeResult(failedResult({ command: "promote", taskId, error: resolved.error, code: "INVALID_STATUS" }), options.json);
      return;
    }
    logError(resolved.error);
    return;
  }

  const { target: targetStatus, isDefault } = resolved;

  // Validate the transition
  const transitionError = validateTransition(task.status, targetStatus);
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    if (options.json) {
      const nextCommands = allowed.map((s) => ({
        command: `taskforge promote ${taskId} --to "${s}"`,
        purpose: `Advance task to "${s}"`,
        when: "after invalid transition attempt",
        allowedFor: "all" as const,
        priority: 1 as const,
      }));
      writeResult(failedResult({
        command: "promote",
        taskId,
        error: transitionError,
        code: "INVALID_TRANSITION",
        nextCommands,
      }), options.json);
      return;
    }
    logError(transitionError);
    logSub(`Allowed transitions from "${task.status}": ${allowed.join(", ")}`);
    return;
  }

  // Update the task status
  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
  }

  const fromStatus = current.status;
  current.status = targetStatus as typeof current.status;
  writeTaskFile(current);

  // Push state changes to shared task-state branch
  await commitAndPushTaskState(repoRoot, `chore: promote ${taskId} — ${fromStatus} → ${targetStatus}`);

  const nextAllowed = getAllowedTransitions(targetStatus);
  const guidance = isDefault
    ? `Task ${taskId} promoted from "${fromStatus}" to "${targetStatus}".`
    : `Task ${taskId} promoted from "${fromStatus}" to "${targetStatus}".`;

  if (options.json) {
    writeResult(successResult({
      command: "promote",
      taskId,
      guidance,
      nextCommands: nextAllowed.length > 0
        ? [
            {
              command: `taskforge promote ${taskId}`,
              purpose: `Advance to next status from "${targetStatus}"`,
              when: "after promotion",
              allowedFor: "all" as const,
              priority: 1 as const,
            },
            {
              command: `taskforge promote ${taskId} --to "${nextAllowed[0]}"`,
              purpose: `Advance to "${nextAllowed[0]}"`,
              when: "after promotion",
              allowedFor: "all" as const,
              priority: 2 as const,
            },
          ]
        : [],
    }), options.json);
    return;
  }

  logSuccess(`Task ${taskId} promoted`);
  logSub(`  From: "${fromStatus}"`);
  logSub(`  To:   "${targetStatus}"`);
  if (nextAllowed.length > 0) {
    logDivider();
    logSub("Next allowed transitions:");
    for (const s of nextAllowed) {
      logSub(`  taskforge promote ${taskId} --to "${s}"`);
    }
  }
}
