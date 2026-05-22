import { loadTaskById, loadAllTasks, updateTaskStatus, updateTaskLock, appendAgentNote } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { pullTaskState } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { generateSessionId } from "../core/session.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import { eventLogEvent } from "../core/event-log.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";

export interface ClaimOptions {
  force?: boolean;
  json?: boolean;
  session?: string;
}

export async function cmdClaim(taskId: string, options?: ClaimOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const force = options?.force ?? false;
  const json = options?.json ?? false;

  await pullTaskState(repoRoot);
  await sweepStaleTasks(repoRoot, { commit: true });

  const task = loadTaskById(taskId);

  if (!task) {
    if (json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (task.status !== STATUS.READY && task.status !== STATUS.IN_PROGRESS) {
    if (json) {
      printJson(jsonError(
        `Cannot claim task with status "${task.status}". Must be "${STATUS.READY}" or "${STATUS.IN_PROGRESS}".`,
        "INVALID_STATUS",
      ));
      return;
    }
    throw new Error(
      `Cannot claim task with status "${task.status}". Must be "${STATUS.READY}" or "${STATUS.IN_PROGRESS}".`,
    );
  }

  // Doctor-lock check
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    if (json) {
      printJson(jsonError(`System is in doctor recovery mode: ${lock.reason}`, "DOCTOR_LOCKED"));
      return;
    }
    logWarn(`System is in doctor recovery mode: ${lock.reason}`);
    return;
  }

  // Hard guardrail: check outstanding session tasks
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    if (json) {
      printJson(jsonError(
        `You still own task ${outstanding}. Close it first with 'taskforge done ${outstanding}'.`,
        "OUTSTANDING_TASK",
      ));
      return;
    }
    logError(`You still own task ${outstanding}.`);
    logInfo(`Run 'taskforge done ${outstanding}' to mark it complete first.`);
    return;
  }

  if (task.assignee && !force) {
    if (json) {
      printJson(jsonError(
        `Task ${taskId} is already claimed by session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. Use --force to override.`,
        "ALREADY_CLAIMED",
      ));
      return;
    }
    logError(
      `Task ${taskId} is already claimed by session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. ` +
      `Use --force to override (only if you are sure the claim is stale).`,
    );
    return;
  }

  if (task.assignee && force && !json) {
    logWarn(`Overriding stale claim from session "${task.assignee}".`);
  }

  const sessionId = options?.session ?? generateSessionId();

  updateTaskLock(task.filePath, sessionId);

  if (task.status === STATUS.READY) {
    const transitionError = validateTransition(task.status, STATUS.IN_PROGRESS);
    if (transitionError) {
      throw new InvalidStatusTransitionError(task.status, STATUS.IN_PROGRESS, [STATUS.IN_PROGRESS]);
    }
    updateTaskStatus(task.filePath, STATUS.IN_PROGRESS);
    if (!json) {
      logSuccess(`Status updated: ${STATUS.READY} → ${STATUS.IN_PROGRESS}`);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task claimed via taskforge claim ${taskId}`,
    `Session: ${sessionId}`,
  ]);

  // Push using transactional CAS reapply
  try {
    await withTaskStateTransaction(
      { command: `claim ${taskId}`, maxRetries: 3 },
      async (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);
        if (fresh.assignee && fresh.assignee !== sessionId) {
          throw new Error(`Task ${taskId} was claimed by session "${fresh.assignee}" during our push`);
        }
        tx.claimTask(taskId, sessionId);
      },
    );
  } catch (err) {
    if (json) {
      printJson(jsonError(
        `Failed to push claim: ${err instanceof Error ? err.message : String(err)}`,
        "PUSH_FAILED",
      ));
      return;
    }
    logError(`Failed to push claim for ${taskId}. The task may have been claimed by another agent.`);
    return;
  }

  if (json) {
    // Re-read the task after push for accurate state
    const updated = loadTaskById(taskId);
    eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
    printJson(jsonOk({
      task: updated ? buildJsonTask(updated) : buildJsonTask(task),
    }));
    return;
  }

  logSuccess(`Task ${taskId} claimed. Session: ${sessionId}`);
  logInfo(`Run 'taskforge start ${taskId}' to create the worktree and begin work.`);
  eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
}
