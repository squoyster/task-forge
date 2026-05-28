import crypto from "node:crypto";
import { getCurrentBranch } from "./git.js";
import type { Task } from "./task.js";
import type { ParsedTask } from "./task-store.js";
import { TaskForgeError } from "./errors.js";
import { STATUS } from "../util/status-constants.js";

/**
 * Generate a 10-character hex session ID (5 bytes).
 */
export function generateSessionId(): string {
  return crypto.randomBytes(5).toString("hex");
}

/**
 * Extract the session GUID from a branch name.
 * Branch format: agent/TASK-NNN-<slug>--<10-char-hex>
 * The `--` separator makes the GUID unambiguous.
 */
export function parseSessionIdFromBranch(branch: string): string | null {
  const match = branch.match(/--([a-f0-9]{10})$/);
  return match ? match[1] : null;
}

/**
 * Assert that the current worktree's branch session owns the task.
 * Throws if the session doesn't match assignee.
 */
export async function assertTaskOwnership(
  task: Task,
  repoRoot: string,
): Promise<void> {
  if (!task.assignee) return; // No assignee — ownership not required

  const branch = await getCurrentBranch(repoRoot);
  const agentSession = parseSessionIdFromBranch(branch);

  if (!agentSession) {
    throw new TaskForgeError(
      `Cannot determine session ID from branch "${branch}". ` +
      `Expected format: agent/TASK-NNN-<session-id>`,
      "OWNERSHIP_UNKNOWN",
    );
  }

  if (agentSession !== task.assignee) {
    throw new TaskForgeError(
      `Task ${task.id} is assigned to session "${task.assignee}", ` +
      `but this worktree's branch "${branch}" identifies as "${agentSession}". ` +
      `Normal agents must not use force unlock. ` +
      `Valid next commands: taskforge inspect ${task.id} --json, taskforge doctor --json, ` +
      `or taskforge block ${task.id} "Ownership mismatch requires human or doctor recovery" --category unsafe_operation --blocked-by human.`,
      "OWNERSHIP_MISMATCH",
    );
  }
}

/**
 * Hard guardrail: check if the current session has any outstanding
 * In Progress tasks that were not properly closed via the CLI.
 * Returns the blocking task ID if found, null if clear.
 *
 * This prevents an agent from starting a new task when they still
 * have an un-closed task — regardless of manual file edits.
 */
export async function checkOutstandingSessionTasks(
  tasks: ParsedTask[],
  repoRoot: string,
  excludeTaskId?: string,
): Promise<string | null> {
  try {
    const branch = await getCurrentBranch(repoRoot);
    const sessionId = parseSessionIdFromBranch(branch);
    if (!sessionId) return null;

    for (const t of tasks) {
      if (t.id === excludeTaskId) continue;
      if (t.assignee === sessionId && t.status === STATUS.IN_PROGRESS) {
        return t.id;
      }
      if (t.assignee === sessionId && t.status !== STATUS.IN_PROGRESS) {
        return t.id;
      }
    }
  } catch {
    return null;
  }
  return null;
}
