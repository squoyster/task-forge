import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { removeSessionState } from "../core/session-state.js";
import { markAgentIdle } from "../core/agent-registry.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export interface ReleaseOptions {
  json?: boolean;
}

export async function cmdRelease(taskId: string, options?: ReleaseOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) {
      writeResult(failedResult({ command: "release", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), true);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (!task.assignee) {
    if (options?.json) {
      writeResult(successResult({ command: "release", taskId, guidance: `Task ${taskId} is not claimed — nothing to release.` }), true);
      return;
    }
    logInfo(`Task ${taskId} is not claimed — nothing to release.`);
    logDivider();
    logInfo("Next actions:");
    logSub(`  taskforge claim ${taskId}   — Claim this task`);
    logSub(`  taskforge start ${taskId}   — Claim and create worktree`);
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

  // Remove session state file (task is released, no recovery needed)
  if (task.worktree) {
    removeSessionState(task.worktree);
  }

  // Mark agent as idle in registry
  if (previousAssignee) {
    markAgentIdle(previousAssignee, repoRoot);
  }

  await commitAndPushTaskState(repoRoot, `chore: release ${taskId}`);

  if (options?.json) {
    const nextCommands = [
      { command: "taskforge next", purpose: "Find the next available task", when: "After release", allowedFor: "all" as const, priority: 1 },
      { command: "taskforge claim <id>", purpose: "Claim a different task", when: "After release", allowedFor: "all" as const, priority: 2 },
    ];
    writeResult(successResult({ command: "release", taskId, guidance: `Task ${taskId} released by "${previousAssignee}"${wasInProgress ? " and reset to Ready" : ""}. Run 'taskforge next' to find the next task, or 'taskforge claim <id>' to claim a different task.`, nextCommands }), true);
    return;
  }

  logSuccess(`Task ${taskId} released.${wasInProgress ? " Status reset to Ready." : ""}`);
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next            — Find the next available task");
  logSub("  taskforge claim <id>      — Claim a different task");
}
