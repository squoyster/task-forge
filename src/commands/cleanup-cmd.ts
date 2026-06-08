import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { removeWorktree, removeBranch, commitAndPushTaskState } from "../core/git.js";
import { inspectTask } from "./inspect.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logInfo, logSub, logError, logDivider } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError } from "../util/json-result.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { successResult, noopResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

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
  const json = options?.json ?? false;

  if (!task) {
    const errorResult = failedResult({
      command: "cleanup",
      taskId,
      error: `Task ${taskId} not found`,
      code: "TASK_NOT_FOUND",
      nextCommands: getValidNextCommands("cleanup", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errorResult) + "\n");
    } else {
      throw new TaskNotFoundError(taskId);
    }
    return;
  }

  const apply = options?.apply ?? false;
  const force = options?.force ?? false;
  const dryRun = !apply && !force;

  // Force authority check
  if (force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const errorResult = failedResult({
          command: "cleanup",
          taskId,
          error: "Normal agents may not use --force.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextCommands: getForceRejectionNextActions(taskId).map((nc) => ({
            command: nc.command,
            purpose: nc.reason,
            when: "When force operation is denied",
            allowedFor: nc.safety === "requires_human" ? "human" : "doctor" as "doctor" | "human",
            priority: 1,
          })),
        });
        if (json) {
          process.stdout.write(renderResultJson(errorResult) + "\n");
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
        process.stdout.write(renderResultMarkdown(errorResult) + "\n");
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

  const itemsApplied = apply || force;

  const success = successResult({
    command: "cleanup",
    taskId,
    guidance: itemsApplied
      ? `Cleanup ${taskId}: ${items.filter(i => i.status === "removed").length} resource(s) removed.`
      : `Cleanup ${taskId} (dry-run): ${items.filter(i => i.status === "would_remove").length} resource(s) would be removed.`,
    nextCommands: getValidNextCommands("cleanup", "success"),
  });

  if (json) {
    process.stdout.write(renderResultJson(success) + "\n");
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
  process.stdout.write(renderResultMarkdown(success) + "\n");
}
