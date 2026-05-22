import { loadTaskById, updateTaskStatus, updateTaskLock, appendAgentNote, clearTaskLock } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { jitteredPush } from "../core/git.js";
import { generateSessionId } from "../core/session.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import { eventLogEvent } from "../core/event-log.js";

export interface ClaimOptions {
  force?: boolean;
  json?: boolean;
  session?: string;
}

export async function cmdClaim(taskId: string, options?: ClaimOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const force = options?.force ?? false;
  const json = options?.json ?? false;

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

  const pushed = await jitteredPush(repoRoot, `chore: claim ${taskId} [session: ${sessionId}]`, {
    onConflict: async (_stateDir: string) => {
      const currentTask = loadTaskById(taskId);
      if (!currentTask) {
        if (!json) logWarn(`Task ${taskId} disappeared after rebase. Aborting.`);
        return false;
      }
      if (currentTask.assignee && currentTask.assignee !== sessionId) {
        if (!json) {
          logWarn(
            `Another agent (session "${currentTask.assignee}") claimed ${taskId} while we were pushing. ` +
            `Abandoning claim.`,
          );
        }
        clearTaskLock(task.filePath);
        return false;
      }
      return true;
    },
  });

  if (!pushed) {
    if (json) {
      printJson(jsonError(
        `Failed to push claim for ${taskId}. The task may have been claimed by another agent.`,
        "PUSH_FAILED",
      ));
      return;
    }
    logError(
      `Failed to push claim for ${taskId}. The task may have been claimed by another agent. ` +
      `Run 'taskforge next' to find another task.`,
    );
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
