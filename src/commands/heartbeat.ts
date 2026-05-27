import { loadTaskById, parseTaskFile, writeTaskFile, appendAgentNote } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { assertTaskOwnership } from "../core/session.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logInfo, logError, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
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
  const { force = false, json = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (task.status !== STATUS.IN_PROGRESS) {
    if (json) {
      printJson(jsonError(
        `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". Heartbeat is only valid for In Progress tasks.`,
        "INVALID_STATUS",
      ));
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

  if (!force && task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch (err) {
      if (json) {
        printJson(jsonError(
          `Task ${taskId} is assigned to session "${task.assignee}".`,
          "OWNERSHIP_MISMATCH",
          { nextActions: getForceRejectionNextActions(taskId) },
        ));
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
    printJson(jsonOk({
      task: buildJsonTask(current),
    }));
    return;
  }

  logSuccess(`Heartbeat: task ${taskId} lease renewed.`);
  if (force) {
    logInfo(`  (authorized: ${authority} — ownership not required)`);
  }
}
