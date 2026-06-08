import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";

export interface ReleaseOptions {
  json?: boolean;
}

export async function cmdRelease(taskId: string, options?: ReleaseOptions): Promise<void> {
  const startTime = Date.now();
  const json = options?.json ?? false;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (json) {
      console.log(JSON.stringify({
        ok: false,
        error: `Task ${taskId} not found`,
        code: "TASK_NOT_FOUND",
      }, null, 2));
      return;
    }
    throw new TaskNotFoundError(taskId);
    return;
  }

  if (!task.assignee) {
    const taskData = {
      id: task.id,
      title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
      status: task.status,
      priority: task.priority,
      agentRole: task.agentRole,
      assignee: task.assignee,
    };

    if (json) {
      console.log(JSON.stringify({
        ok: true,
        task: taskData,
        nextActions: ["claim", "start"],
        guidance: `Task ${taskId} is not claimed. Run 'taskforge claim ${taskId}' to claim it, or 'taskforge start ${taskId}' to claim and create a worktree.`,
      }, null, 2));
      return;
    } else {
      logInfo(`Task ${taskId} is not claimed — nothing to release.`);
      logDivider();
      logInfo("Next actions:");
      logSub(`  taskforge claim ${taskId}   — Claim this task`);
      logSub(`  taskforge start ${taskId}   — Claim and create worktree`);

      const result = noopResult({
        command: "release",
        reason: `Task ${taskId} is not claimed.`,
        nextCommands: getValidNextCommands("release", "noop"),
        duration: Date.now() - startTime,
      });
      process.stdout.write(renderResultMarkdown(result) + "\n");
      return;
    }
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

  await commitAndPushTaskState(repoRoot, `chore: release ${taskId}`);

  const updated = loadTaskById(taskId);
  const taskData = {
    id: task.id,
    title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
    status: updated?.status ?? task.status,
    priority: task.priority,
    agentRole: task.agentRole,
    assignee: updated?.assignee,
  };

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      task: taskData,
      nextActions: ["next", "claim"],
      guidance: `Task ${taskId} released by "${previousAssignee}"${wasInProgress ? " and reset to Ready" : ""}. Run 'taskforge next' to find the next task, or 'taskforge claim <id>' to claim a different task.`,
    }, null, 2));
    return;
  }

  logSuccess(`Task ${taskId} released.${wasInProgress ? " Status reset to Ready." : ""}`);
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next            — Find the next available task");
  logSub("  taskforge claim <id>      — Claim a different task");

  const result = successResult({
    command: "release",
    guidance: `Task ${taskId} released by "${previousAssignee}"${wasInProgress ? " and reset to Ready" : ""}. Run 'taskforge next' to find the next task, or 'taskforge claim <id>' to claim a different task.`,
    nextCommands: getValidNextCommands("release", "success"),
    duration: Date.now() - startTime,
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}