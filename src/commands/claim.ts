import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { pullTaskState, createWorktree, checkUncommittedWorktrees } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { parseSessionIdFromBranch, resolveSessionId } from "../core/session.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { loadConfig } from "../core/config.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError, logDivider, logSub } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot, getWorktreePath, makeBranchName } from "../util/paths.js";
import { eventLogEvent } from "../core/event-log.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { resolveAuthority, assertCanForce, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { claimStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { writeSessionState } from "../core/session-state.js";
import { registerAgent } from "../core/agent-registry.js";
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
  // Auto-reclaim stale-claimed tasks before claiming (gated by sweep.autoReclaim, default on).
  if (loadConfig(repoRoot)?.sweep?.autoReclaim ?? true) {
    await sweepStaleTasks(repoRoot, { commit: true });
  }

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
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "DOCTOR_LOCKED" }), json);
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
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "OUTSTANDING_TASK" }), json);
      return;
    }
    logError(result.guidance);
    return;
  }

  // Uncommitted worktree check
  const allTasks = loadAllTasks(repoRoot);
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, allTasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result = claimStateMachine({
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
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "UNCOMMITTED_CHANGES" }), json);
      return;
    }
    logWarn(result.guidance);
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
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "TASK_NOT_FOUND" }), json);
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
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "INVALID_STATUS" }), json);
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
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "ALREADY_CLAIMED" }), json);
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
          writeResult(failedResult({ command: "claim", error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR" }), json);
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

  const sessionId = options?.session ?? await resolveSessionId(repoRoot);

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
        } else {
          // Check whether existing branch name has a stale session ID
          const oldSession = parseSessionIdFromBranch(fresh.branch);
          if (oldSession && oldSession !== sessionId) {
            const titleMatch = fresh.body.match(/^#\s+\S+:\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : taskId;
            fresh.branch = makeBranchName(taskId, title, sessionId);
          }
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
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "PUSH_FAILED" }), json);
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

  // Persist worktree path to task-state (enables resume to find the worktree)
  if (worktreePath) {
    try {
      await withTaskStateTransaction(
        { command: `claim ${taskId} [workspace]`, maxRetries: 2 },
        (tx) => {
          const t = tx.loadTask(taskId);
          if (t) {
            t.worktree = worktreePath;
            tx.updateTask(t);
            tx.appendNote(taskId, "System", [`Worktree created: ${worktreePath}`]);
          }
        },
      );
    } catch {
      // Non-fatal: worktree exists and is usable even if recording fails
    }
  }

  // Write session state file for agent recovery across restarts
  if (worktreePath) {
    writeSessionState(worktreePath, {
      session_id: sessionId,
      task_id: taskId,
      claimed_at: new Date().toISOString(),
      worktree_path: worktreePath,
      last_heartbeat: new Date().toISOString(),
    });
  }

  // Register agent in distributed registry
  registerAgent(sessionId, taskId, worktreePath ?? null, repoRoot);

  // Build success result through state machine
  const claimResult = claimStateMachine({
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
  getDefaultGuidanceAdapter().pushGuidance(claimResult);

  if (json) {
    // Reload after push to get the latest claimed state
    eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
    writeResult(successResult({
      command: "claim",
      taskId: task.id,
      guidance: claimResult.guidance,
      worktree: worktreePath,
      branch: branchName,
      sessionId,
    }), json);
    return;
  }

  // Report status transition if it changed
  if (task.status === STATUS.READY) {
    logSuccess(`Status updated: ${STATUS.READY} → ${STATUS.IN_PROGRESS}`);
  }

  logSuccess(claimResult.guidance);
  if (worktreePath) {
    logSuccess(`Worktree: ${worktreePath}`);
    logSuccess(`Branch: ${branchName}`);
    logInfo(`cd ${worktreePath} to begin work.`);
  }
  eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
}
