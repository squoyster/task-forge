import { loadTaskById, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logError, logInfo, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export interface UnlockOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdUnlock(
  taskId: string,
  options: UnlockOptions = {},
): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options.json) {
      writeResult(failedResult({ command: "unlock", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (!task.assignee) {
    if (options.json) {
      writeResult(successResult({ command: "unlock", taskId, guidance: `Task ${taskId} is not claimed.` }), options.json);
      return;
    }
    logWarn(`Task ${taskId} is not claimed.`);
    return;
  }

  if (!options.force) {
    if (options.json) {
      const nextCommands = getForceRejectionNextActions(taskId).map(a => ({
        command: a.command,
        purpose: a.reason,
        when: a.reason,
        allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor") as "all" | "human" | "doctor",
        priority: a.preferred ? 1 : 2,
      }));
      writeResult(failedResult({ command: "unlock", taskId, error: `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}.`, code: "NEEDS_FORCE", nextCommands }), options.json);
      return;
    }
    logError(
      `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. ` +
      `Unlock requires human or doctor-mode authorization.`,
    );
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

  // Force authority check
  const authority = resolveAuthority();
  try {
    assertCanForce(authority);
  } catch (err) {
    if (err instanceof ForceRequiresHumanOrDoctorError) {
      if (options.json) {
        const nextCommands = getForceRejectionNextActions(taskId).map(a => ({
          command: a.command,
          purpose: a.reason,
          when: a.reason,
          allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor") as "all" | "human" | "doctor",
          priority: a.preferred ? 1 : 2,
        }));
        writeResult(failedResult({ command: "unlock", taskId, error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), options.json);
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

  const previousAssignee = task.assignee;
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task unlocked (authorized: ${authority}) — previous claim was held by session "${previousAssignee}"`,
  ]);

  // Push state changes
  await commitAndPushTaskState(repoRoot, `chore: unlock ${taskId}`);

  if (options.json) {
    writeResult(successResult({ command: "unlock", taskId, guidance: `Task ${taskId} unlocked.` }), options.json);
    return;
  }

  logSuccess(`Task ${taskId} unlocked. Claim from session "${previousAssignee}" has been cleared.`);
}
