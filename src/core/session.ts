import crypto from "node:crypto";
import { getCurrentBranch } from "./git.js";
import type { Task } from "./task.js";
import { TaskForgeError } from "./errors.js";

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
 * Throws if the session doesn't match lockedBy.
 */
export async function assertTaskOwnership(
  task: Task,
  repoRoot: string,
): Promise<void> {
  if (!task.lockedBy) return; // No lock — ownership not required

  const branch = await getCurrentBranch(repoRoot);
  const agentSession = parseSessionIdFromBranch(branch);

  if (!agentSession) {
    throw new TaskForgeError(
      `Cannot determine session ID from branch "${branch}". ` +
      `Expected format: agent/TASK-NNN-<session-id>`,
      "OWNERSHIP_UNKNOWN",
    );
  }

  if (agentSession !== task.lockedBy) {
    throw new TaskForgeError(
      `Task ${task.id} is locked by session "${task.lockedBy}", ` +
      `but this worktree's branch "${branch}" identifies as "${agentSession}". ` +
      `Use 'taskforge unlock ${task.id} --force' to release the lock.`,
      "OWNERSHIP_MISMATCH",
    );
  }
}
