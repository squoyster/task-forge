import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logInfo, logError, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { STATUS } from "../util/status-constants.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { updateSessionHeartbeat } from "../core/session-state.js";
import { updateAgentHeartbeat } from "../core/agent-registry.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export interface HeartbeatOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdHeartbeat(
  taskId: string,
  options: HeartbeatOptions = {},
): Promise<void> {
  const { force = false, json = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (json) {
      writeResult(failedResult({ command: "heartbeat", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (task.status !== STATUS.IN_PROGRESS) {
    if (json) {
      writeResult(failedResult({ command: "heartbeat", taskId, error: `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". Heartbeat is only valid for In Progress tasks.`, code: "INVALID_STATUS" }), json);
      return;
    }
    logError(
      `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". ` +
      `Heartbeat is only valid for In Progress tasks.`,
    );
    return;
  }

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
          writeResult(failedResult({ command: "heartbeat", taskId, error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), json);
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

  if (!force && task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch (err) {
      if (json) {
        const nextCommands = getForceRejectionNextActions(taskId).map(a => ({
          command: a.command,
          purpose: a.reason,
          when: a.reason,
          allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor") as "all" | "human" | "doctor",
          priority: a.preferred ? 1 : 2,
        }));
        writeResult(failedResult({ command: "heartbeat", taskId, error: `Task ${taskId} is assigned to session "${task.assignee}".`, code: "OWNERSHIP_MISMATCH", nextCommands }), json);
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

  // Update session state file heartbeat if it exists
  if (current.worktree) {
    updateSessionHeartbeat(current.worktree);
  }

  // Update agent registry heartbeat
  if (current.assignee) {
    updateAgentHeartbeat(current.assignee, repoRoot);
  }

  await commitAndPushTaskState(repoRoot, `chore: heartbeat ${taskId}`);

  if (json) {
    writeResult(successResult({ command: "heartbeat", taskId, guidance: `Heartbeat: task ${taskId} lease renewed.` }), json);
    return;
  }

  logSuccess(`Heartbeat: task ${taskId} lease renewed.`);
  if (force) {
    logInfo(`  (authorized: ${authority} — ownership not required)`);
  }
}
