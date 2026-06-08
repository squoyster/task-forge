import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { pullTaskState, createWorktree, checkUncommittedWorktrees } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { generateSessionId } from "../core/session.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot, getWorktreePath, makeBranchName } from "../util/paths.js";
import { eventLogEvent } from "../core/event-log.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { claimStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";
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
    const smResult = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: true,
      doctorReason: lock.reason,
      hasOutstandingTask: false,
      pushSucceeded: false,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "DOCTOR_LOCKED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On doctor lock", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logWarn(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  // Hard guardrail: check outstanding session tasks
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    const smResult = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstanding,
      pushSucceeded: false,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "OUTSTANDING_TASK",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On outstanding task", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logError(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  // Uncommitted worktree check
  const allTasks = loadAllTasks(repoRoot);
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, allTasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const smResult = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
      uncommittedWorktrees: [{
        taskId: dirty.taskId,
        status: dirty.status,
        dirtyFiles: dirty.dirtyFiles,
      }],
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "UNCOMMITTED_CHANGES",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On uncommitted changes", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logWarn(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  if (!task) {
    const smResult = claimStateMachine({
      taskFound: false,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "TASK_NOT_FOUND",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On task not found", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (task.status !== STATUS.READY && task.status !== STATUS.IN_PROGRESS) {
    const smResult = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "INVALID_STATUS",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On invalid task status", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    throw new Error(smResult.guidance);
  }

  if (task.assignee && !force) {
    const smResult = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : undefined,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "ALREADY_CLAIMED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On already claimed", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logError(smResult.guidance);
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose whether a recovery path exists.");
    logSub("   Safety: safe");
    logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
    logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
    logSub("   Safety: requires_human");
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  // Force authority check
  if (task.assignee && force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const errResult = failedResult({
          command: "claim",
          taskId,
          error: "Normal agents may not use --force.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextCommands: getForceRejectionNextActions(taskId).map((nc) => ({
            command: nc.command,
            purpose: nc.reason,
            when: "When force operation is denied",
            allowedFor: nc.safety === "requires_human" ? ("human" as const) : ("doctor" as const),
            priority: 1,
          })),
        });
        if (json) {
          process.stdout.write(renderResultJson(errResult) + "\n");
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
        process.stdout.write(renderResultMarkdown(errResult) + "\n");
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
    const smResult = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "claim",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "PUSH_FAILED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On push failure", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("claim", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logError(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
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
  const smSuccessResult = claimStateMachine({
    taskFound: true,
    taskStatus: task.status,
    doctorLocked: false,
    hasOutstandingTask: false,
    pushSucceeded: true,
    worktreeExists: !!worktreePath,
    worktreePath,
    taskId,
    sessionId,
  });
  getDefaultGuidanceAdapter().pushGuidance(smSuccessResult);

  const okResult = successResult({
    command: "claim",
    taskId,
    sessionId,
    worktree: worktreePath,
    branch: branchName,
    guidance: smSuccessResult.guidance,
    nextCommands: getValidNextCommands("claim", "success"),
  });

  if (json) {
    eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
    process.stdout.write(renderResultJson(okResult) + "\n");
    return;
  }

  // Report status transition if it changed
  if (task.status === STATUS.READY) {
    logSuccess(`Status updated: ${STATUS.READY} → ${STATUS.IN_PROGRESS}`);
  }

  logSuccess(smSuccessResult.guidance);
  if (worktreePath) {
    logSuccess(`Worktree: ${worktreePath}`);
    logSuccess(`Branch: ${branchName}`);
    logInfo(`cd ${worktreePath} to begin work.`);
  }
  eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
  process.stdout.write(renderResultMarkdown(okResult) + "\n");
}
