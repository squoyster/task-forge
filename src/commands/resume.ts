import { loadTaskById } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logSub, logDivider, logWarn, logSuccess, logInfo } from "../util/logging.js";
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
    if (options?.json) {
      printJson(jsonError(
        `Task is not In Progress (current: ${task.status})`,
        "INVALID_STATUS",
        { nextActions: task.status === STATUS.READY ? ["start", "claim"] : ["next"], guidance: `Task ${taskId} is in "${task.status}" status. Use 'taskforge start ${taskId}' to begin, or 'taskforge next' to find a different task.` },
      ));
    } else {
      logWarn(`Task ${taskId} is not In Progress (current: ${task.status}).`);
      logDivider();
      logInfo("Next actions:");
      if (task.status === STATUS.READY) {
        logSub(`  taskforge start ${taskId}   — Begin working on this task`);
        logSub(`  taskforge claim ${taskId}   — Claim without worktree`);
      }
      logSub("  taskforge next            — Find the next available task");
    }
    return;
  }

  const wtPath = getWorktreePath(repoRoot, taskId);
  const worktreeExists = fs.existsSync(wtPath);

  if (!worktreeExists && !options?.json) {
    logWarn(`Worktree not found at ${wtPath}.`);
    logDivider();
    logInfo("Next actions:");
    logSub(`  taskforge start ${taskId}   — Recreate the worktree and begin working`);
    logSub("  taskforge next            — Find the next available task");
    return;
  }

  if (!worktreeExists && options?.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
      workspace: { branch: task.branch, worktree: task.worktree ?? wtPath, exists: false },
      nextActions: ["start", "next"],
      guidance: `Worktree not found. Run 'taskforge start ${taskId}' to recreate it, or 'taskforge next' to find a different task.`,
    }));
    return;
  }

  if (options?.json) {
    printJson(jsonOk({
      task: buildJsonTask(task),
      workspace: { branch: task.branch, worktree: task.worktree ?? wtPath, exists: true },
      nextActions: ["work", "checkpoint", "done"],
      guidance: `Resume working in ${wtPath}. Use 'taskforge checkpoint ${taskId}' to save progress, or 'taskforge done ${taskId}' when complete.`,
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
  logSub(`5. Use 'taskforge checkpoint ${taskId}' to save progress`);
  logSub(`6. Use 'taskforge done ${taskId}' when complete`);
  logDivider();
  logSuccess(`Ready to resume ${taskId}.`);
}
