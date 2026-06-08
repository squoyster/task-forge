import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export async function cmdReject(taskId: string, reason: string, options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) {
      writeResult(failedResult({ command: "reject", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), true);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  updateTaskStatus(task.filePath, STATUS.REJECTED);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [`Task rejected: ${reason}`]);

  await commitAndPushTaskState(repoRoot, `chore: reject ${taskId}`);

  if (options?.json) {
    const nextCommands = [
      { command: 'taskforge new "<title>"', purpose: "Create a replacement task", when: "After rejection", allowedFor: "all" as const, priority: 1 },
      { command: "taskforge next", purpose: "Find the next available task", when: "After rejection", allowedFor: "all" as const, priority: 2 },
    ];
    writeResult(successResult({ command: "reject", taskId, guidance: `Task ${taskId} rejected. Run 'taskforge new "<title>"' to create a replacement task, or 'taskforge next' to find the next available task.`, nextCommands }), true);
    return;
  }

  logSuccess(`Task ${taskId} rejected: ${reason}`);
  logDivider();
  logInfo("Next actions:");
  logSub('  taskforge new "<title>"  — Create a replacement task');
  logSub("  taskforge next           — Find the next available task");
}
