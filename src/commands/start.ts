import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { createWorktree, checkUncommittedWorktrees } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { makeBranchName } from "../util/paths.js";
import { generateSessionId } from "../core/session.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { hashControlFiles } from "../core/control-files.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError, logHeader, logSub, logDivider } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError, WorktreeError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { startStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

export interface StartOptions {
  force?: boolean;
  json?: boolean;
}

export async function cmdStart(taskId: string, options?: StartOptions): Promise<void> {
  const repoRoot = getRepoRoot();

  // Pull latest task-state and sweep before claiming
  await pullTaskState(repoRoot);
  await sweepStaleTasks(repoRoot, { commit: true });

  // Reload task after sweeping (it may have been reset to Ready)
  const task = loadTaskById(taskId);

  // Generate session ID early so pre-checks can distinguish same-session
  // re-entry from cross-session conflicts.
  const sessionId = generateSessionId();
  // Doctor-lock check
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    const smResult = startStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: true,
      doctorReason: lock.reason,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "DOCTOR_LOCKED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On doctor lock", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logWarn(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  if (!task) {
    const smResult = startStateMachine({
      taskFound: false,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: "TASK_NOT_FOUND",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Suggested next action", when: "On task not found", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // Validate status
  if (task.status !== STATUS.READY && task.status !== STATUS.IN_PROGRESS) {
    const smResult = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: "INVALID_STATUS",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Use valid status to start", when: "On invalid status", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.IN_PROGRESS,
      [STATUS.READY, STATUS.IN_PROGRESS],
    );
  }

  // Hard guardrail: check outstanding session tasks (exclude current for resume)
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    const smResult = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstanding,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: "OUTSTANDING_TASK",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Complete outstanding task first", when: "On outstanding task", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logWarn(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  // Uncommitted worktree check: if the agent has dirty worktrees, they must
  // complete the current task before starting a new one.
  const allTasks = loadAllTasks(repoRoot);
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, allTasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const smResult = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
      uncommittedWorktrees: [{
        taskId: dirty.taskId,
        status: dirty.status,
        dirtyFiles: dirty.dirtyFiles,
      }],
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: "UNCOMMITTED_CHANGES",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Commit or stash changes first", when: "On uncommitted changes", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logWarn(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  // Lock check: if task is locked by a DIFFERENT session, reject unless --force.
  // Same-session re-entry is allowed (e.g., agent restart after crash).
  if (task.assignee && task.assignee !== sessionId && !options?.force) {
    const smResult = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : undefined,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "ALREADY_ASSIGNED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Use force to override", when: "On already assigned", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
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

  // Force authority check (only needed when stealing from a different session)
  if (task.assignee && task.assignee !== sessionId && options?.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const errResult = failedResult({
          command: "start",
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
        if (options?.json) {
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
    if (!options?.json) {
      logWarn(`Overriding stale claim from session "${task.assignee}" (authorized: ${authority}).`);
    }
  }

  // Set branch name in memory (will be persisted by transaction)
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title, sessionId);
  }

  const contextHash = hashControlFiles(repoRoot);

  // --- Phase 1: Claim (durable — all writes inside transaction) ---
  // All file writes happen inside the transaction to avoid inconsistent
  // state if the push fails. Pre-transaction writes caused git pull --rebase
  // to fail silently (uncommitted local changes), leaving the task claimed
  // locally but not on remote.

  const pushed = await withTaskStateTransaction(
    { command: `claim ${taskId}`, maxRetries: 3 },
    async (tx) => {
      const fresh = tx.loadTask(taskId);
      if (!fresh) throw new Error("Task disappeared");
      if (fresh.assignee && fresh.assignee !== sessionId && !options?.force) {
        throw new Error(`Claimed by ${fresh.assignee}`);
      }
      tx.claimTask(taskId, sessionId);
      // Set branch and context_hash as part of the claim
      fresh.branch = task.branch;
      fresh.context_hash = contextHash;
      tx.updateTask(fresh);
      tx.appendNote(taskId, "System", [
        `Task claimed via taskforge start ${taskId}${options?.force ? " (forced)" : ""}`,
        `Session: ${sessionId}`,
        `Branch: ${task.branch}`,
      ]);
      return true;
    },
  ).catch(() => false);

  if (!pushed) {
    const smResult = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : undefined,
      force: options?.force,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "PUSH_FAILED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Retry claim", when: "On push failure", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    logError(smResult.guidance);
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  // Reload task after successful transaction to get persisted state
  const claimedTask = loadTaskById(taskId);
  if (!claimedTask) {
    logError(`Task ${taskId} disappeared after claim.`);
    return;
  }
  claimedTask.branch = task.branch; // Ensure branch is set for worktree creation


  // --- Phase 2: Workspace (only after claim is durably pushed) ---

  try {
    const result = await createWorktree(repoRoot, task);
    task.worktree = result.path;

    if (!options?.json) {
      if (result.created) {
        logSuccess(`Created worktree at: ${result.path}`);
        logSuccess(`Created branch: ${result.branch}`);
      } else {
        logInfo(`Worktree already exists at: ${result.path}`);
      }
    }
  } catch (err) {
    const smResult = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const errResult = failedResult({
      command: "start",
      taskId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "WORKTREE_FAILED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Create worktree manually", when: "On worktree failure", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("start", "failed"),
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(errResult) + "\n");
      return;
    }
    throw new WorktreeError(
      `Could not create worktree: ${err instanceof Error ? err.message : String(err)}`,
    );
  }


  // Push metadata update through transaction
  await withTaskStateTransaction(
    { command: `start ${taskId} [workspace]`, maxRetries: 2 },
    (tx) => {
      const t = tx.loadTask(taskId);
      if (t) {
        t.worktree = task.worktree;
        tx.updateTask(t);
        tx.appendNote(taskId, "System", [`Worktree created: ${task.worktree}`]);
      }
    },
  );

  // Build success result through state machine
  const smSuccessResult = startStateMachine({
    taskFound: true,
    taskStatus: task.status,
    doctorLocked: false,
    hasOutstandingTask: false,
    pushSucceeded: true,
    worktreeCreated: true,
    taskId,
    sessionId,
    worktreePath: task.worktree,
    branch: task.branch,
  });
  getDefaultGuidanceAdapter().pushGuidance(smSuccessResult);

  const okResult = successResult({
    command: "start",
    taskId,
    sessionId,
    worktree: task.worktree,
    branch: task.branch,
    guidance: smSuccessResult.guidance,
    nextCommands: getValidNextCommands("start", "success"),
  });

  // Success output
  if (options?.json) {
    process.stdout.write(renderResultJson(okResult) + "\n");
    return;
  }

  // Print agent instructions
  logDivider();
  logHeader(`## Task Started: ${taskId}`);
  logSub(`**Title:** ${taskId}`);
  logSub(`**Session:** ${sessionId}`);
  logSub(`**Branch:** ${task.branch}`);
  logSub(`**Worktree:** ${task.worktree ?? "not created"}`);
  logDivider();
  logHeader(`### Agent Instructions`);
  logDivider();
  logSub(`1. cd ${task.worktree ?? repoRoot}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read ${repoRoot}/AGENTS.md (if present)`);
  logSub(`4. Read ${task.filePath}`);
  logSub(`5. Work only on ${taskId}`);
  logSub(`6. Use the continuation policy from TASKFORGE.md`);
  logSub(`7. Do not stop unless a human-intervention condition occurs`);
  logSub(`8. Update task notes before ending`);
  logDivider();
  logHeader(`### Quick Start`);
  logDivider();
  logSub(`cd ${task.worktree ?? repoRoot}`);
  logSub(`opencode`);
  logDivider();
  logInfo(smSuccessResult.guidance);
  process.stdout.write(renderResultMarkdown(okResult) + "\n");
}