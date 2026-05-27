import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { removeWorktree, removeBranch, commitAndPushTaskState } from "../core/git.js";
import { inspectTask } from "./inspect.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logInfo, logSub, logError, logDivider } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError } from "../util/json-result.js";
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
    if (options?.json) printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
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
          printJson(jsonError(
            "Normal agents may not use --force.",
            "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
            { nextActions: getForceRejectionNextActions(taskId) },
          ));
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
    printJson(jsonOk({
      cleanup: { items },
      nextActions: [
        { command: "taskforge next", reason: "Find the next available task after cleanup.", safety: "safe" as const, preferred: true },
      ],
    } as never));
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
