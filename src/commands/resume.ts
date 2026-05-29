import { loadTaskById } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logSub, logDivider, logWarn, logSuccess, logInfo } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";
import fs from "node:fs";
import { STATUS } from "../util/status-constants.js";

export async function cmdResume(taskId: string, options?: { json?: boolean }): Promise<void> {
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

  if (task.status !== STATUS.IN_PROGRESS) {
    const nextActions = task.status === STATUS.READY ? ["start", "claim"] : ["next"];
    const guidance = `Task ${taskId} is in "${task.status}" status. Use 'taskforge start ${taskId}' to begin, or 'taskforge next' to find a different task.`;

    if (json) {
      console.log(JSON.stringify({
        ok: false,
        error: `Task is not In Progress (current: ${task.status})`,
        code: "INVALID_STATUS",
        nextActions,
        guidance,
      }, null, 2));
      return;
    } else {
      logWarn(`Task ${taskId} is not In Progress (current: ${task.status}).`);
      logDivider();
      logInfo("Next actions:");
      if (task.status === STATUS.READY) {
        logSub(`  taskforge start ${taskId}   — Begin working on this task`);
        logSub(`  taskforge claim ${taskId}   — Claim without worktree`);
      }
      logSub("  taskforge next            — Find the next available task");

      const result = failedResult({
        command: "resume",
        error: `Task ${taskId} is not In Progress (current: ${task.status})`,
        code: "INVALID_STATUS",
        nextCommands: getValidNextCommands("resume", "failed"),
        duration: Date.now() - startTime,
      });
      process.stdout.write(renderResultMarkdown(result) + "\n");
      return;
    }
  }

  const wtPath = getWorktreePath(repoRoot, taskId);
  const worktreeExists = fs.existsSync(wtPath);

  if (!worktreeExists && !json) {
    logWarn(`Worktree not found at ${wtPath}.`);
    logDivider();
    logInfo("Next actions:");
    logSub(`  taskforge start ${taskId}   — Recreate the worktree and begin working`);
    logSub("  taskforge next            — Find the next available task");

    const result = failedResult({
      command: "resume",
      error: `Worktree not found at ${wtPath}`,
      code: "WORKTREE_NOT_FOUND",
      nextCommands: getValidNextCommands("resume", "failed"),
      duration: Date.now() - startTime,
    });
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  if (!worktreeExists && json) {
    const taskData = {
      id: task.id,
      title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
      status: task.status,
      priority: task.priority,
      agentRole: task.agentRole,
    };

    console.log(JSON.stringify({
      ok: true,
      task: taskData,
      workspace: { branch: task.branch, worktree: task.worktree ?? wtPath, exists: false },
      nextActions: ["start", "next"],
      guidance: `Worktree not found. Run 'taskforge start ${taskId}' to recreate it, or 'taskforge next' to find a different task.`,
    }, null, 2));
    return;
  }

  if (json) {
    const taskData = {
      id: task.id,
      title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
      status: task.status,
      priority: task.priority,
      agentRole: task.agentRole,
    };

    console.log(JSON.stringify({
      ok: true,
      task: taskData,
      workspace: { branch: task.branch, worktree: task.worktree ?? wtPath, exists: true },
      nextActions: ["work", "checkpoint", "done"],
      guidance: `Resume working in ${wtPath}. Use 'taskforge checkpoint ${taskId}' to save progress, or 'taskforge done ${taskId}' when complete.`,
    }, null, 2));
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

  const result = successResult({
    command: "resume",
    guidance: `Resume working in ${wtPath}. Use 'taskforge checkpoint ${taskId}' to save progress, or 'taskforge done ${taskId}' when complete.`,
    nextCommands: getValidNextCommands("resume", "success"),
    duration: Date.now() - startTime,
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
