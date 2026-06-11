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
 * Resolve a stable session ID by checking the current branch first.
 *
 * If the current branch contains a session ID (e.g., `agent/TASK-NNN-desc--abc123`),
 * reuse that ID. This ensures a single agent keeps the same session across
 * multiple `claim`/`start` invocations from the same worktree.
 *
 * Only generates a new random ID when no branch session is found
 * (e.g., running from `main` or a non-task branch).
 *
 * This is how the distributed mutex works: the session ID embedded in the
 * branch name IS the lock key. Reusing it means the same agent holds the
 * same lock across multiple tasks.
 */
export async function resolveSessionId(repoRoot: string): Promise<string> {
  const branch = await getCurrentBranch(repoRoot);
  const existing = parseSessionIdFromBranch(branch);
  if (existing) return existing;
  return generateSessionId();
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

interface OwnershipContext {
  sessionId: string | null;
  branch: string | null;
  source: "task.branch" | "task.worktree" | "current.branch";
}

async function resolveOwnershipContext(task: Task, repoRoot: string): Promise<OwnershipContext> {
  if (task.branch) {
    return {
      sessionId: parseSessionIdFromBranch(task.branch),
      branch: task.branch,
      source: "task.branch",
    };
  }

  if (task.worktree) {
    const branch = await getCurrentBranch(task.worktree);
    return {
      sessionId: parseSessionIdFromBranch(branch),
      branch,
      source: "task.worktree",
    };
  }

  const branch = await getCurrentBranch(repoRoot);
  return {
    sessionId: parseSessionIdFromBranch(branch),
    branch,
    source: "current.branch",
  };
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

  const context = await resolveOwnershipContext(task, repoRoot);
  const agentSession = context.sessionId;

  if (!agentSession) {
    const branchDetail = context.branch ? `"${context.branch}"` : "an unknown branch";
    throw new TaskForgeError(
      `Cannot determine session ID for ${task.id} from ${context.source} ${branchDetail}. ` +
      `Task context: branch=${task.branch ?? "unset"}, worktree=${task.worktree ?? "unset"}. ` +
      `Expected branch format: agent/TASK-NNN-<slug>--<10-char-session-id>.`,
      "OWNERSHIP_UNKNOWN",
    );
  }

  if (agentSession !== task.assignee) {
    throw new TaskForgeError(
      `Task ${task.id} is assigned to session "${task.assignee}", ` +
      `but ${context.source} branch "${context.branch}" identifies as "${agentSession}". ` +
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
