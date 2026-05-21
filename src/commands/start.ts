import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { createWorktree } from "../core/git.js";
import { makeBranchName, getWorktreePath } from "../util/paths.js";
import { logInfo, logSuccess, logWarn, logHeader, logSub, logDivider, logError } from "../util/logging.js";
import { getRepoRoot } from "../util/paths.js";

export async function cmdStart(taskId: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    logError(`Task ${taskId} not found.`);
    process.exit(1);
  }

  // Validate status
  if (task.status !== "Ready" && task.status !== "In Progress") {
    logError(`Task ${taskId} has status '${task.status}'. Must be 'Ready' or 'In Progress' to start.`);
    process.exit(1);
  }

  // Create worktree and branch
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title);
  }

  try {
    const result = await createWorktree(repoRoot, task);
    task.worktree = result.path;

    if (result.created) {
      logSuccess(`Created worktree at: ${result.path}`);
      logSuccess(`Created branch: ${result.branch}`);
    } else {
      logInfo(`Worktree already exists at: ${result.path}`);
    }
  } catch (err) {
    logWarn(`Could not create worktree: ${err instanceof Error ? err.message : String(err)}`);
    logInfo("Continuing without worktree...");
  }

  // Update status to In Progress if it was Ready
  if (task.status === "Ready") {
    const transitionError = validateTransition(task.status, "In Progress");
    if (transitionError) {
      logError(transitionError);
      process.exit(1);
    }
    updateTaskStatus(task.filePath, "In Progress");
    logSuccess("Status updated: Ready → In Progress");
  }

  // Append agent note
  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task started via taskforge start ${taskId}`,
    `Branch: ${task.branch}`,
    `Worktree: ${task.worktree ?? "none"}`,
  ]);

  // Print agent instructions
  logDivider();
  logHeader(`## Task Started: ${taskId}`);
  logSub(`**Title:** ${taskId}`);
  logSub(`**Branch:** ${task.branch}`);
  logSub(`**Worktree:** ${task.worktree ?? "not created"}`);
  logDivider();
  logHeader(`### Agent Instructions`);
  logDivider();
  logSub(`1. cd ${task.worktree ?? repoRoot}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read ${repoRoot}/AGENTS.md (if present)`);
  logSub(`4. Read ${task.filePath}`);
  logSub(`5. Work only on ${taskId}`);
  logSub(`6. Use the continuation policy from TASKFORGE.md`);
  logSub(`7. Do not stop unless a human-intervention condition occurs`);
  logSub(`8. Update task notes before ending`);
  logDivider();
  logHeader(`### Quick Start`);
  logDivider();
  logSub(`cd ${task.worktree ?? repoRoot}`);
  logSub(`opencode`);
}
