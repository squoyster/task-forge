import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { removeWorktree, removeBranch, commitAndPushTaskState } from "../core/git.js";
import { inspectTask } from "./inspect.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logInfo, logSub, logError, logDivider } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";

export interface CleanupOptions {
  dryRun?: boolean;
  apply?: boolean;
  force?: boolean;
  json?: boolean;
}

interface CleanupItem {
  resource: string;
  status: "removed" | "skipped" | "would_remove";
  reason?: string;
}

export async function cmdCleanup(taskId: string, options?: CleanupOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) writeResult(failedResult({ command: "cleanup", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
    else throw new TaskNotFoundError(taskId);
    return;
  }

  const apply = options?.apply ?? false;
  const force = options?.force ?? false;
  const dryRun = !apply && !force;
  const json = options?.json ?? false;

  // Force authority check
  if (force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        if (json) {
          const nextCommands = getForceRejectionNextActions(taskId).map(a => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor") as "all" | "human" | "doctor",
            priority: a.preferred ? 1 : 2,
          }));
          writeResult(failedResult({
            command: "cleanup",
            taskId,
            error: "Normal agents may not use --force.",
            code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
            nextCommands,
          }), json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
        logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
        logSub("   Safety: requires_human");
        return;
      }
      throw err;
    }
  }

  const items: CleanupItem[] = [];

  // Inspect worktree
  let insp;
  try {
    insp = await inspectTask(task, repoRoot);
  } catch {
    insp = null;
  }

  // Check worktree
  if (task.worktree && insp?.worktreeExists) {
    if (insp.dirty && !force) {
      items.push({ resource: "worktree", status: dryRun ? "would_remove" : "skipped", reason: "dirty worktree — uncommitted changes" });
    } else if (insp.aheadOfMain > 0 && !force) {
      items.push({ resource: "worktree", status: dryRun ? "would_remove" : "skipped", reason: `${insp.aheadOfMain} commit(s) ahead of main` });
    } else if (!dryRun) {
      await removeWorktree(repoRoot, taskId);
      items.push({ resource: "worktree", status: "removed" });
    } else {
      items.push({ resource: "worktree", status: "would_remove" });
    }
  } else if (task.worktree) {
    items.push({ resource: "worktree", status: "skipped", reason: "worktree not found" });
  }

  // Check branch
  if (task.branch) {
    if (!dryRun) {
      try {
        await removeBranch(repoRoot, task.branch);
        items.push({ resource: "branch", status: "removed" });
      } catch {
        items.push({ resource: "branch", status: "skipped", reason: "failed to delete" });
      }
    } else {
      items.push({ resource: "branch", status: "would_remove" });
    }
  }

  // Clear frontmatter if applying
  if (apply || force) {
    const current = parseTaskFile(task.filePath);
    if (current) {
      current.worktree = undefined;
      current.branch = undefined;
      writeTaskFile(current);

      const today = new Date().toISOString().split("T")[0];
      const authority = resolveAuthority();
      appendAgentNote(current.filePath, today, "System", [
        `Cleanup: worktree and branch removed${force ? ` (authorized: ${authority})` : ""}`,
      ]);

      await commitAndPushTaskState(repoRoot, `chore: cleanup ${taskId}`);
    }
  }

  if (json) {
    writeResult(successResult({
      command: "cleanup",
      taskId,
      guidance: `Cleanup ${taskId}: removed worktree/branch.`,
      nextCommands: [
        { command: "taskforge next", purpose: "Find the next available task after cleanup.", when: "Find the next available task after cleanup.", allowedFor: "all", priority: 1 },
      ],
    }), json);
    return;
  }

  if (dryRun) {
    logInfo(`Cleanup ${taskId} (dry-run):`);
  } else {
    logSuccess(`Cleanup ${taskId}:`);
  }
  for (const item of items) {
    if (item.status === "skipped") {
      logWarn(`  ${item.resource}: ${item.reason}`);
    } else if (item.status === "would_remove") {
      logSub(`  ${item.resource}: would be removed`);
    } else {
      logSuccess(`  ${item.resource}: removed`);
    }
  }
}
