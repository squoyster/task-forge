import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { pullTaskState, createWorktree } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { generateSessionId } from "../core/session.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot, getWorktreePath, makeBranchName } from "../util/paths.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import { eventLogEvent } from "../core/event-log.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { claimStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import fs from "node:fs";

export interface ClaimOptions {
  force?: boolean;
  json?: boolean;
  session?: string;
}

export async function cmdClaim(taskId: string, options?: ClaimOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const force = options?.force ?? false;
  const json = options?.json ?? false;

  await pullTaskState(repoRoot);
  await sweepStaleTasks(repoRoot, { commit: true });

  const task = loadTaskById(taskId);

  // Doctor-lock check
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    const result = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: true,
      doctorReason: lock.reason,
      hasOutstandingTask: false,
      pushSucceeded: false,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      printJson(jsonError(result.guidance, result.errorCode ?? "DOCTOR_LOCKED", {
        nextActions: [result.nextAction],
        guidance: result.guidance,
      }));
      return;
    }
    logWarn(result.guidance);
    return;
  }

  // Hard guardrail: check outstanding session tasks
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    const result = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstanding,
      pushSucceeded: false,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      printJson(jsonError(result.guidance, result.errorCode ?? "OUTSTANDING_TASK", {
        nextActions: [result.nextAction],
        guidance: result.guidance,
      }));
      return;
    }
    logError(result.guidance);
    return;
  }

  if (!task) {
    const result = claimStateMachine({
      taskFound: false,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      printJson(jsonError(result.guidance, result.errorCode ?? "TASK_NOT_FOUND", {
        nextActions: [result.nextAction],
        guidance: result.guidance,
      }));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (task.status !== STATUS.READY && task.status !== STATUS.IN_PROGRESS) {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      printJson(jsonError(result.guidance, result.errorCode ?? "INVALID_STATUS", {
        nextActions: [result.nextAction],
        guidance: result.guidance,
      }));
      return;
    }
    throw new Error(result.guidance);
  }

  if (task.assignee && !force) {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : undefined,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      printJson(jsonError(
        result.guidance,
        result.errorCode ?? "ALREADY_CLAIMED",
        { nextActions: getForceRejectionNextActions(taskId) },
      ));
      return;
    }
    logError(result.guidance);
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
  if (task.assignee && force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const result = claimStateMachine({
          taskFound: true,
          taskStatus: task.status,
          taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : undefined,
          force: true,
          doctorLocked: false,
          hasOutstandingTask: false,
          pushSucceeded: false,
          taskId,
        });
        getDefaultGuidanceAdapter().pushGuidance(result);
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
    if (!json) {
      logWarn(`Overriding stale claim from session "${task.assignee}" (authorized: ${authority}).`);
    }
  }

  const sessionId = options?.session ?? generateSessionId();

  // Push claim through transaction — all file writes happen inside the transaction
  // to avoid inconsistent state if the push fails.
  let worktreePath: string | undefined;
  let branchName: string | undefined;

  try {
    await withTaskStateTransaction(
      { command: `claim ${taskId}`, maxRetries: 3 },
      async (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);
        if (fresh.assignee && fresh.assignee !== sessionId && !force) {
          throw new Error(`Task ${taskId} was claimed by session "${fresh.assignee}" during our push`);
        }
        tx.claimTask(taskId, sessionId);

        // Set branch name for worktree creation
        if (!fresh.branch) {
          const titleMatch = fresh.body.match(/^#\s+\S+:\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : taskId;
          fresh.branch = makeBranchName(taskId, title, sessionId);
        }
        tx.updateTask(fresh);
        branchName = fresh.branch;

        tx.appendNote(taskId, "System", [
          `Task claimed via taskforge claim ${taskId}${force ? " (forced)" : ""}`,
          `Session: ${sessionId}`,
        ]);
      },
    );
  } catch {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      printJson(jsonError(
        result.guidance,
        result.errorCode ?? "PUSH_FAILED",
        { nextActions: [result.nextAction], guidance: result.guidance },
      ));
      return;
    }
    logError(result.guidance);
    return;
  }

  // Create worktree so the agent has a workspace immediately
  const wtPath = getWorktreePath(repoRoot, taskId);
  if (fs.existsSync(wtPath)) {
    worktreePath = wtPath;
  } else {
    try {
      const result = await createWorktree(repoRoot, {
        id: taskId,
        branch: branchName ?? makeBranchName(taskId, taskId, sessionId),
      } as Parameters<typeof createWorktree>[1]);
      worktreePath = result.path;
      branchName = result.branch;
    } catch {
      // Worktree creation is non-fatal — claim succeeded even if workspace failed
      worktreePath = undefined;
    }
  }

  // Build success result through state machine
  const successResult = claimStateMachine({
    taskFound: true,
    taskStatus: task.status,
    doctorLocked: false,
    hasOutstandingTask: false,
    pushSucceeded: true,
    taskId,
    sessionId,
  });
  getDefaultGuidanceAdapter().pushGuidance(successResult);

  if (json) {
    // Re-read the task after push for accurate state
    const updated = loadTaskById(taskId);
    eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
    printJson(jsonOk({
      task: updated ? buildJsonTask(updated) : buildJsonTask(task),
      workspace: {
        branch: branchName,
        worktree: worktreePath,
      },
      nextActions: [successResult.nextAction],
      guidance: successResult.guidance,
    }));
    return;
  }

  // Report status transition if it changed
  if (task.status === STATUS.READY) {
    logSuccess(`Status updated: ${STATUS.READY} → ${STATUS.IN_PROGRESS}`);
  }

  logSuccess(successResult.guidance);
  if (worktreePath) {
    logSuccess(`Worktree: ${worktreePath}`);
    logSuccess(`Branch: ${branchName}`);
    logInfo(`cd ${worktreePath} to begin work.`);
  } else {
    logInfo(`Run 'taskforge start ${taskId}' to create the worktree.`);
  }
  eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
}
