import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";

export async function cmdReject(taskId: string, reason: string, options?: { json?: boolean }): Promise<void> {
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

  updateTaskStatus(task.filePath, STATUS.REJECTED);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [`Task rejected: ${reason}`]);

  await commitAndPushTaskState(repoRoot, `chore: reject ${taskId}`);

  const updated = loadTaskById(taskId);
  const taskData = {
    id: task.id,
    title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
    status: updated?.status ?? STATUS.REJECTED,
    priority: task.priority,
    agentRole: task.agentRole,
  };

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      task: taskData,
      nextActions: ["new", "next"],
      guidance: `Task ${taskId} rejected. Run 'taskforge new "<title>"' to create a replacement task, or 'taskforge next' to find the next available task.`,
    }, null, 2));
    return;
  }

  logSuccess(`Task ${taskId} rejected: ${reason}`);
  logDivider();
  logInfo("Next actions:");
  logSub('  taskforge new "<title>"  — Create a replacement task');
  logSub("  taskforge next           — Find the next available task");

  const result = successResult({
    command: "reject",
    guidance: `Task ${taskId} rejected. Run 'taskforge new "<title>"' to create a replacement task, or 'taskforge next' to find the next available task.`,
    nextCommands: getValidNextCommands("reject", "success"),
    duration: Date.now() - startTime,
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
