import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { createWorktree, checkUncommittedWorktrees } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { makeBranchName } from "../util/paths.js";
import { resolveSessionId, parseSessionIdFromBranch, checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { hashControlFiles } from "../core/control-files.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState } from "../core/git.js";
import { STATUS } from "../util/status-constants.js";
import { logInfo, logSuccess, logWarn, logError, logHeader, logSub, logDivider } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError, WorktreeError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";
import { startStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { writeSessionState } from "../core/session-state.js";
import { registerAgent } from "../core/agent-registry.js";

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

  // Resolve session ID early so pre-checks can distinguish same-session
  // re-entry from cross-session conflicts.
  // Reuses the existing branch's session ID if already in a task worktree.
  const sessionId = await resolveSessionId(repoRoot);
  // Doctor-lock check
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    const result = startStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: true,
      doctorReason: lock.reason,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", error: result.guidance, code: result.errorCode ?? "DOCTOR_LOCKED" }), options.json);
      return;
    }
    logWarn(result.guidance);
    return;
  }

  if (!task) {
    const result = startStateMachine({
      taskFound: false,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // Validate status
  const startableStatuses: string[] = [STATUS.READY, STATUS.IN_PROGRESS, STATUS.REVIEW, STATUS.VERIFY];
  if (!startableStatuses.includes(task.status)) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "INVALID_STATUS" }), options.json);
      return;
    }
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.IN_PROGRESS,
      [STATUS.READY, STATUS.IN_PROGRESS, STATUS.REVIEW, STATUS.VERIFY],
    );
  }

  // Hard guardrail: check outstanding session tasks (exclude current for resume)
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstanding,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "OUTSTANDING_TASK" }), options.json);
      return;
    }
    logWarn(result.guidance);
    return;
  }

  // Uncommitted worktree check: if the agent has dirty worktrees, they must
  // complete the current task before starting a new one.
  const allTasks = loadAllTasks(repoRoot);
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, allTasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result = startStateMachine({
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
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "UNCOMMITTED_CHANGES" }), options.json);
      return;
    }
    logWarn(result.guidance);
    return;
  }

  // Lock check: if task is locked by a DIFFERENT session, reject unless --force.
  // Same-session re-entry is allowed (e.g., agent restart after crash).
  if (task.assignee && task.assignee !== sessionId && !options?.force) {
    const result = startStateMachine({
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
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      const nextCommands = getForceRejectionNextActions(taskId).map(a => ({
        command: a.command,
        purpose: a.reason,
        when: a.reason,
        allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : a.safety === "doctor_only" ? "doctor" : "all") as "all" | "human" | "doctor" | "agent",
        priority: a.preferred ? 1 : 2,
      }));
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "ALREADY_ASSIGNED", nextCommands }), options.json);
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

  // Force authority check (only needed when stealing from a different session)
  if (task.assignee && task.assignee !== sessionId && options?.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const result = startStateMachine({
          taskFound: true,
          taskStatus: task.status,
          taskAssignee: task.assignee,
          taskClaimedAt: task.claimed_at ? String(task.claimed_at) : undefined,
          force: true,
          doctorLocked: false,
          hasOutstandingTask: false,
          pushSucceeded: false,
          worktreeCreated: false,
          taskId,
        });
        getDefaultGuidanceAdapter().pushGuidance(result);
        if (options?.json) {
          const nextCommands = getForceRejectionNextActions(taskId).map(a => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : a.safety === "doctor_only" ? "doctor" : "all") as "all" | "human" | "doctor" | "agent",
            priority: a.preferred ? 1 : 2,
          }));
          writeResult(failedResult({ command: "start", taskId, error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), options.json);
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
    if (!options?.json) {
      logWarn(`Overriding stale claim from session "${task.assignee}" (authorized: ${authority}).`);
    }
  }

  // Set branch name in memory (will be persisted by transaction)
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title, sessionId);
  } else {
    // Re-claim with different session — regenerate branch to match
    const oldSession = parseSessionIdFromBranch(task.branch);
    if (oldSession && oldSession !== sessionId) {
      const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : taskId;
      task.branch = makeBranchName(taskId, title, sessionId);
    }
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
    const result = startStateMachine({
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
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "PUSH_FAILED" }), options.json);
      return;
    }
    logError(result.guidance);
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
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "WORKTREE_FAILED" }), options.json);
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

  // Write session state file for agent recovery across restarts
  if (task.worktree) {
    writeSessionState(task.worktree, {
      session_id: sessionId,
      task_id: taskId,
      claimed_at: new Date().toISOString(),
      worktree_path: task.worktree,
      last_heartbeat: new Date().toISOString(),
    });
  }

  // Register agent in distributed registry
  registerAgent(sessionId, taskId, task.worktree ?? null, repoRoot);

  // Build success result through state machine
  const startResult = startStateMachine({
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
  getDefaultGuidanceAdapter().pushGuidance(startResult);

  // Success output
  if (options?.json) {
    writeResult(successResult({
      command: "start",
      taskId: task.id,
      sessionId,
      branch: task.branch,
      worktree: task.worktree ?? undefined,
      guidance: startResult.guidance,
      nextCommands: [
        { command: "opencode", purpose: "Begin working on the task", when: "Begin working on the task", allowedFor: "all", priority: 1 },
      ],
    }), options.json);
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
  logInfo(startResult.guidance);
}
