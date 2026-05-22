import { loadTaskById } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logSub, logDivider, logWarn, logSuccess } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import fs from "node:fs";
import { STATUS } from "../util/status-constants.js";

export async function cmdResume(taskId: string, options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options?.json) printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
    else throw new TaskNotFoundError(taskId);
    return;
  }

  if (task.status !== STATUS.IN_PROGRESS) {
    if (options?.json) printJson(jsonError("Task is not In Progress", "INVALID_STATUS"));
    else logWarn(`Task ${taskId} is not In Progress (current: ${task.status}). Use 'taskforge start' to begin a new task.`);
    return;
  }

  const wtPath = getWorktreePath(repoRoot, taskId);
  const worktreeExists = fs.existsSync(wtPath);

  if (!worktreeExists && !options?.json) {
    logWarn(`Worktree not found at ${wtPath}. Use 'taskforge start ${taskId}' to recreate.`);
    return;
  }

  if (options?.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
      workspace: { branch: task.branch, worktree: task.worktree ?? wtPath },
    }));
    return;
  }

  logHeader(`## Task Resumed: ${taskId}`);
  logSub(`**Worktree:** ${wtPath}`);
  logSub(`**Branch:** ${task.branch ?? "none"}`);
  logDivider();
  logHeader("### Agent Instructions");
  logDivider();
  logSub(`1. cd ${wtPath}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read the task file at ../task-state/${taskId}.md`);
  logSub(`4. Continue work on ${taskId}`);
  logSub(`5. Use 'taskforge done ${taskId}' when complete`);
  logDivider();
  logSuccess(`Ready to resume ${taskId}.`);
}
