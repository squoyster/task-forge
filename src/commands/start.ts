import { loadTaskById, updateTaskStatus, updateTaskLock, appendAgentNote, clearTaskLock } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { createWorktree, jitteredPush } from "../core/git.js";
import { makeBranchName } from "../util/paths.js";
import { generateSessionId } from "../core/session.js";
import { logInfo, logSuccess, logWarn, logError, logHeader, logSub, logDivider } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError, WorktreeError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";

export interface StartOptions {
  force?: boolean;
}

export async function cmdStart(taskId: string, options?: StartOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  // Validate status
  if (task.status !== "Ready" && task.status !== "In Progress") {
    throw new InvalidStatusTransitionError(
      task.status,
      "In Progress",
      ["Ready", "In Progress"],
    );
  }

  // Lock check: if task is locked by another session, reject unless --force
  if (task.assignee && !options?.force) {
    logError(
      `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. ` +
      `Use --force to override (only if you are sure the claim is stale).`,
    );
    return;
  }

  // If --force, warn about overriding
  if (task.assignee && options?.force) {
    logWarn(`Overriding stale claim from session "${task.assignee}".`);
  }

  // Generate session ID
  const sessionId = generateSessionId();

  // Create worktree and branch with session ID in the name
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title, sessionId);
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
    throw new WorktreeError(
      `Could not create worktree: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Set the lock
  updateTaskLock(task.filePath, sessionId);

  // Update status to In Progress if it was Ready
  if (task.status === "Ready") {
    const transitionError = validateTransition(task.status, "In Progress");
    if (transitionError) {
      throw new InvalidStatusTransitionError(
        task.status,
        "In Progress",
        ["In Progress"],
      );
    }
    updateTaskStatus(task.filePath, "In Progress");
    logSuccess("Status updated: Ready → In Progress");
  }

  // Append agent note
  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task started via taskforge start ${taskId}`,
    `Session: ${sessionId}`,
    `Branch: ${task.branch}`,
    `Worktree: ${task.worktree ?? "none"}`,
  ]);

  // Push state changes to shared task-state branch with jittered retry
  const pushed = await jitteredPush(repoRoot, `chore: start ${taskId} [session: ${sessionId}]`, {
    onConflict: async (_stateDir: string) => {
      // After rebase, re-read the task to check if another agent claimed it
      const currentTask = loadTaskById(taskId);
      if (!currentTask) {
        logWarn(`Task ${taskId} disappeared after rebase. Aborting.`);
        return false;
      }
      if (currentTask.assignee && currentTask.assignee !== sessionId) {
        logWarn(
          `Another agent (session "${currentTask.assignee}") claimed ${taskId} while we were pushing. ` +
          `Abandoning claim.`,
        );
        // Clear our local lock
        clearTaskLock(task.filePath);
        return false;
      }
      // Task is still ours — retry the push
      return true;
    },
  });

  if (!pushed) {
    logError(
      `Failed to push claim for ${taskId}. The task may have been claimed by another agent. ` +
      `Run 'taskforge next' to find another task.`,
    );
    return;
  }

  // Print agent instructions
  logDivider();
  logHeader(`## Task Started: ${taskId}`);
  logSub(`**Title:** ${taskId}`);
  logSub(`**Session:** ${sessionId}`);
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
