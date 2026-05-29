import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logInfo, logError, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";
import { statusToJson } from "../util/json-result.js";
import { STATUS } from "../util/status-constants.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";

export interface HeartbeatOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdHeartbeat(
  taskId: string,
  options: HeartbeatOptions = {},
): Promise<void> {
  const startTime = Date.now();
  const { force = false } = options;
  const json = options?.json ?? false;
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

  if (task.status !== STATUS.IN_PROGRESS) {
    if (json) {
      console.log(JSON.stringify({
        ok: false,
        error: `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". Heartbeat is only valid for In Progress tasks.`,
        code: "INVALID_STATUS",
      }, null, 2));
      return;
    }
    logError(
      `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". ` +
      `Heartbeat is only valid for In Progress tasks.`,
    );
    const result = failedResult({
      command: "heartbeat",
      error: `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}"`,
      code: "INVALID_STATUS",
      nextCommands: getValidNextCommands("heartbeat", "failed"),
      duration: Date.now() - startTime,
    });
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  // Force authority check
  if (force) {
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
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
        logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
        logSub("   Safety: requires_human");

        const result = failedResult({
          command: "heartbeat",
          error: "Normal agents may not use --force.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextCommands: getValidNextCommands("heartbeat", "failed"),
          duration: Date.now() - startTime,
        });
        process.stdout.write(renderResultMarkdown(result) + "\n");
        return;
      }
      throw err;
    }
  }

  if (!force && task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch (err) {
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
          error: `Task ${taskId} is assigned to session "${task.assignee}".`,
          code: "OWNERSHIP_MISMATCH",
          nextActions,
        }, null, 2));
        return;
      }
      throw err;
    }
  }

  const prevClaimedAt = task.claimed_at;

  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
  }

  const now = new Date();
  current.claimed_at = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  writeTaskFile(current);

  const today = now.toISOString().split("T")[0];
  const prevTime = prevClaimedAt
    ? `${prevClaimedAt}`
    : "unknown";
  const agoText = prevClaimedAt && typeof prevClaimedAt === "string"
    ? ` (reset from ${prevTime})`
    : "";

  const authority = resolveAuthority();
  appendAgentNote(current.filePath, today, "System", [
    `Heartbeat: lease renewed${force ? ` (authorized: ${authority})` : ""}${agoText}`,
  ]);

  await commitAndPushTaskState(repoRoot, `chore: heartbeat ${taskId}`);

  if (json) {
    const taskData = {
      id: current.id,
      title: current.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? current.id,
      status: statusToJson(current.status),
      priority: current.priority,
      agentRole: current.agentRole,
      assignee: current.assignee,
    };
    console.log(JSON.stringify({
      ok: true,
      task: taskData,
    }, null, 2));
    return;
  }

  logSuccess(`Heartbeat: task ${taskId} lease renewed.`);
  if (force) {
    logInfo(`  (authorized: ${authority} — ownership not required)`);
  }

  const result = successResult({
    command: "heartbeat",
    guidance: `Heartbeat: task ${taskId} lease renewed.`,
    nextCommands: getValidNextCommands("heartbeat", "success"),
    duration: Date.now() - startTime,
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
