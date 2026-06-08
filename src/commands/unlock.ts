import { loadTaskById, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn, logError, logInfo, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { resolveAuthority, assertCanForce, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { failedResult, successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";

export interface UnlockOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdUnlock(
  taskId: string,
  options: UnlockOptions = {},
): Promise<void> {
  const startTime = Date.now();
  const json = options.json ?? false;
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
  }

  if (!task.assignee) {
    const taskData = {
      id: task.id,
      title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
      status: task.status,
      priority: task.priority,
      agentRole: task.agentRole,
      assignee: task.assignee,
    };

    if (json) {
      console.log(JSON.stringify({
        ok: true,
        task: taskData,
      }, null, 2));
      return;
    }

    const result = noopResult({
      command: "unlock",
      reason: `Task ${taskId} is not claimed.`,
      nextCommands: getValidNextCommands("unlock", "noop"),
      duration: Date.now() - startTime,
    });
    logWarn(`Task ${taskId} is not claimed.`);
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  if (!options.force) {
    const nextActions = [
      {
        command: "taskforge doctor --json",
        reason: "Diagnose whether a recovery path exists.",
        safety: "safe" as const,
      },
      {
        command: `taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`,
        reason: "Escalate unsafe operation without bypassing TaskForge.",
        safety: "requires_human" as const,
      },
    ];

    if (json) {
      console.log(JSON.stringify({
        ok: false,
        error: `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}.`,
        code: "NEEDS_FORCE",
        nextActions,
      }, null, 2));
      return;
    }

    const result = failedResult({
      command: "unlock",
      error: `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. Unlock requires human or doctor-mode authorization.`,
      code: "NEEDS_FORCE",
      nextCommands: getValidNextCommands("unlock", "failed"),
      duration: Date.now() - startTime,
    });
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
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  // Force authority check
  const authority = resolveAuthority();
  try {
    assertCanForce(authority);
  } catch (err) {
    if (err instanceof ForceRequiresHumanOrDoctorError) {
      const nextActions = [
        {
          command: "taskforge doctor --json",
          reason: "Diagnose whether a recovery path exists.",
          safety: "safe" as const,
        },
        {
          command: `taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`,
          reason: "Escalate unsafe operation without bypassing TaskForge.",
          safety: "requires_human" as const,
        },
      ];

      if (json) {
        console.log(JSON.stringify({
          ok: false,
          error: "Normal agents may not use --force.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextActions,
        }, null, 2));
        return;
      }

      const result = failedResult({
        command: "unlock",
        error: "Normal agents may not use --force.",
        code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
        nextCommands: getValidNextCommands("unlock", "failed"),
        duration: Date.now() - startTime,
      });
      logError("Normal agents may not use --force.");
      logDivider();
      logInfo("Valid next actions:");
      logSub("1. taskforge doctor --json");
      logSub("   Reason: Diagnose whether a recovery path exists.");
      logSub("   Safety: safe");
      logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
      logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
      logSub("   Safety: requires_human");
      process.stdout.write(renderResultMarkdown(result) + "\n");
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

  const taskData = {
    id: task.id,
    title: task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? task.id,
    status: task.status,
    priority: task.priority,
    agentRole: task.agentRole,
    assignee: task.assignee,
  };

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      task: taskData,
    }, null, 2));
    return;
  }

  const result = successResult({
    command: "unlock",
    guidance: `Task ${taskId} unlocked. Claim from session "${previousAssignee}" has been cleared.`,
    nextCommands: getValidNextCommands("unlock", "success"),
    duration: Date.now() - startTime,
  });
  logSuccess(`Task ${taskId} unlocked. Claim from session "${previousAssignee}" has been cleared.`);
  process.stdout.write(renderResultMarkdown(result) + "\n");
}