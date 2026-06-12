/**
 * Command state machine for agentic workflow.
 *
 * Each command invocation returns a CommandResult that encodes:
 * - The current state of the operation
 * - The next action the agent should take
 * - Human-readable guidance for continuing or recovering
 * - A machine-readable error code (if applicable)
 *
 * This models the full task lifecycle:
 *   next → claim → start → work → checkpoint → gates → submit → done
 *
 * Every state has explicit guidance for:
 *   - Happy path (proceed to next step)
 *   - Known errors (specific recovery steps)
 *   - Unknown errors (create task, request human input)
 */

import { createClosureTaskCommand } from "./closure-task.js";

export type NextAction =
  | "start_task"
  | "create_worktree"
  | "work_on_task"
  | "commit_changes"
  | "run_gates"
  | "create_pr"
  | "complete_task"
  | "block_task"
  | "release_task"
  | "resolve_dependency"
  | "commit_then_next"
  | "complete_current_then_next"
  | "create_task_for_error"
  | "request_human_input"
  | "retry"
  | "wait"
  | "none";

export interface CommandResult {
  /** Whether the command succeeded */
  ok: boolean;
  /** The state the operation ended in */
  state: string;
  /** What the agent should do next */
  nextAction: NextAction;
  /** Human-readable guidance for the next step */
  guidance: string;
  /** Machine-readable error code (only set when ok is false) */
  errorCode?: string;
  /** Additional context for the result */
  context?: Record<string, unknown>;
}

/**
 * Build a success result with guidance for the next step.
 */
export function success(
  state: string,
  nextAction: NextAction,
  guidance: string,
  context?: Record<string, unknown>,
): CommandResult {
  return { ok: true, state, nextAction, guidance, context };
}

/**
 * Build an error result with recovery guidance.
 */
export function error(
  state: string,
  errorCode: string,
  nextAction: NextAction,
  guidance: string,
  context?: Record<string, unknown>,
): CommandResult {
  return { ok: false, state, errorCode, nextAction, guidance, context };
}

/**
 * Build a result for an unhandled/unknown error case.
 * Directs the agent to create a new task and request human input.
 */
export function unhandledError(
  state: string,
  message: string,
  context?: Record<string, unknown>,
): CommandResult {
  const closureCommand = createClosureTaskCommand("UNMAPPED_ERROR", message, {
    command: state,
    errorMessage: message,
    observedState: context,
  });
  return error(
    state,
    "UNHANDLED_ERROR",
    "create_task_for_error",
    `An unexpected error occurred: ${message}. ` +
    `Please create a new task to handle this case. ` +
    `Suggested closure task command: ${closureCommand}. ` +
    `If the correct action cannot be cleanly inferred, request human input.`,
    context,
  );
}

// ── Task Selection States (next command) ──────────────────────────

export const NextStates = {
  /** A task was selected and is ready to be started */
  TASK_SELECTED: "task_selected",
  /** No tasks found at all */
  NO_TASKS: "no_tasks",
  /** No actionable tasks (all in terminal or waiting states) */
  NO_ACTIONABLE_TASKS: "no_actionable_tasks",
  /** Agent has uncommitted changes in current worktree */
  UNCOMMITTED_CHANGES: "uncommitted_changes",
  /** Current task is blocked, agent should commit and find resolving task */
  CURRENT_TASK_BLOCKED: "current_task_blocked",
  /** Doctor lock is active */
  DOCTOR_LOCKED: "doctor_locked",
  /** Outstanding session task not yet closed */
  OUTSTANDING_TASK: "outstanding_task",
} as const;

/**
 * State machine for `taskforge next`.
 */
export function nextStateMachine(
  conditions: {
    hasTasks: boolean;
    hasActionableTask: boolean;
    hasOutstandingTask: boolean;
    outstandingTaskId?: string;
    doctorLocked: boolean;
    doctorReason?: string;
    uncommittedWorktrees: { taskId: string; status: string; dirtyFiles: number }[];
    selectedTaskId?: string;
    selectedTaskDependsOn?: string[];
    unmetDependencies?: string[];
  },
): CommandResult {
  // Doctor lock — highest priority block
  if (conditions.doctorLocked) {
    return error(
      NextStates.DOCTOR_LOCKED,
      "DOCTOR_LOCKED",
      "wait",
      `System is in doctor recovery mode: ${conditions.doctorReason ?? "unknown"}. ` +
      `All agents are paused. Wait until recovery is complete.`,
    );
  }

  // Outstanding session task
  if (conditions.hasOutstandingTask && conditions.outstandingTaskId) {
    return error(
      NextStates.OUTSTANDING_TASK,
      "OUTSTANDING_TASK",
      "complete_current_then_next",
      `You still own task ${conditions.outstandingTaskId}. ` +
      `Run 'taskforge done ${conditions.outstandingTaskId}' to mark it complete, ` +
      `or 'taskforge release ${conditions.outstandingTaskId}' to abandon the claim. ` +
      `Then run 'taskforge next' again.`,
    );
  }

  // No tasks at all
  if (!conditions.hasTasks) {
    return error(
      NextStates.NO_TASKS,
      "NO_TASKS",
      "request_human_input",
      "No task files found. The project may not be initialized. " +
      "Run 'taskforge init' or request human input to set up the task workflow.",
    );
  }

  // Uncommitted worktree changes
  if (conditions.uncommittedWorktrees.length > 0) {
    const dirty = conditions.uncommittedWorktrees[0];
    const isBlocked = dirty.status === "Blocked";

    if (isBlocked) {
      return error(
        NextStates.CURRENT_TASK_BLOCKED,
        "UNCOMMITTED_BLOCKED_TASK",
        "commit_then_next",
        `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s) and is in Blocked status. ` +
        `1. Commit your current changes: taskforge checkpoint -m "WIP: save progress on ${dirty.taskId}"\n` +
        `2. Look for the next task that resolves the block: taskforge next\n` +
        `3. If no resolving task is available, continue with the next available task.`,
        { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles },
      );
    }

    return error(
      NextStates.UNCOMMITTED_CHANGES,
      "UNCOMMITTED_CHANGES",
      "complete_current_then_next",
      `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s). ` +
      `Complete the current task before proceeding to the next task. ` +
      `Run 'taskforge done ${dirty.taskId}' when ready, or 'taskforge checkpoint' to save progress.`,
      { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles },
    );
  }

  // No actionable tasks
  if (!conditions.hasActionableTask) {
    return error(
      NextStates.NO_ACTIONABLE_TASKS,
      "NO_ACTIONABLE_TASKS",
      "request_human_input",
      "All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, " +
      "or blocked by dependencies. Request human input to prioritize or unblock work.",
    );
  }

  // Happy path — task selected
  const depInfo = conditions.unmetDependencies && conditions.unmetDependencies.length > 0
    ? ` (waiting on: ${conditions.unmetDependencies.join(", ")})`
    : "";

  return success(
    NextStates.TASK_SELECTED,
    "start_task",
    `Next task: ${conditions.selectedTaskId}${depInfo}. ` +
    `Run 'taskforge start ${conditions.selectedTaskId}' to begin.`,
    { taskId: conditions.selectedTaskId },
  );
}

// ── Claim States ──────────────────────────────────────────────────

export const ClaimStates = {
  TASK_CLAIMED: "task_claimed",
  TASK_NOT_FOUND: "task_not_found",
  INVALID_STATUS: "invalid_status",
  ALREADY_CLAIMED: "already_claimed",
  PUSH_FAILED: "push_failed",
  DOCTOR_LOCKED: "doctor_locked",
  OUTSTANDING_TASK: "outstanding_task",
  UNCOMMITTED_CHANGES: "uncommitted_changes",
} as const;

export function claimStateMachine(
  conditions: {
    taskFound: boolean;
    taskStatus?: string;
    taskAssignee?: string;
    taskClaimedAt?: string;
    force?: boolean;
    doctorLocked: boolean;
    doctorReason?: string;
    hasOutstandingTask: boolean;
    outstandingTaskId?: string;
    uncommittedWorktrees?: { taskId: string; status: string; dirtyFiles: number }[];
    pushSucceeded: boolean;
    worktreeExists?: boolean;
    worktreePath?: string;
    sessionId?: string;
    taskId?: string;
  },
): CommandResult {
  if (conditions.doctorLocked) {
    return error(
      ClaimStates.DOCTOR_LOCKED,
      "DOCTOR_LOCKED",
      "wait",
      `System is in doctor recovery mode: ${conditions.doctorReason ?? "unknown"}. ` +
      `All agents are paused. Wait until recovery is complete.`,
    );
  }

  if (conditions.hasOutstandingTask && conditions.outstandingTaskId) {
    return error(
      ClaimStates.OUTSTANDING_TASK,
      "OUTSTANDING_TASK",
      "complete_current_then_next",
      `You still own task ${conditions.outstandingTaskId}. ` +
      `Close it first with 'taskforge done ${conditions.outstandingTaskId}'.`,
    );
  }

  if (conditions.uncommittedWorktrees && conditions.uncommittedWorktrees.length > 0) {
    const dirty = conditions.uncommittedWorktrees[0];
    const isBlocked = dirty.status === "Blocked";
    if (isBlocked) {
      return error(
        ClaimStates.UNCOMMITTED_CHANGES,
        "UNCOMMITTED_BLOCKED_TASK",
        "commit_then_next",
        `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s) and is in Blocked status. ` +
        `1. Commit your current changes: taskforge checkpoint -m "WIP: save progress on ${dirty.taskId}"\n` +
        `2. Look for the next task that resolves the block: taskforge next\n` +
        `3. If no resolving task is available, continue with the next available task.`,
        { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles },
      );
    }
    return error(
      ClaimStates.UNCOMMITTED_CHANGES,
      "UNCOMMITTED_CHANGES",
      "complete_current_then_next",
      `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s). ` +
      `Complete the current task before claiming a new one. ` +
      `Run 'taskforge done ${dirty.taskId}' when ready, or 'taskforge checkpoint' to save progress.`,
      { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles },
    );
  }

  if (!conditions.taskFound) {
    return error(
      ClaimStates.TASK_NOT_FOUND,
      "TASK_NOT_FOUND",
      "request_human_input",
      `Task ${conditions.taskId} not found. ` +
      `The task file may have been deleted or the ID is incorrect. ` +
      `Request human input to verify the task exists.`,
      { taskId: conditions.taskId },
    );
  }

  if (conditions.taskStatus !== "Ready" && conditions.taskStatus !== "In Progress") {
    return error(
      ClaimStates.INVALID_STATUS,
      "INVALID_STATUS",
      "request_human_input",
      `Cannot claim task with status "${conditions.taskStatus}". ` +
      `Must be "Ready" or "In Progress". ` +
      `If the task should be claimable, request human input to correct its status.`,
      { taskId: conditions.taskId, status: conditions.taskStatus },
    );
  }

  if (conditions.taskAssignee && !conditions.force) {
    return error(
      ClaimStates.ALREADY_CLAIMED,
      "ALREADY_CLAIMED",
      "request_human_input",
      `Task ${conditions.taskId} is already claimed by session "${conditions.taskAssignee}" ` +
      `since ${conditions.taskClaimedAt ?? "unknown"}. ` +
      `Normal agents may not use --force. ` +
      `Valid next commands: taskforge doctor --json, taskforge inspect ${conditions.taskId} --json, ` +
      `or taskforge block ${conditions.taskId} "Already claimed; override requires human or doctor authority" --category unsafe_operation --blocked-by human.`,
      { taskId: conditions.taskId, assignee: conditions.taskAssignee },
    );
  }

  if (!conditions.pushSucceeded) {
    return error(
      ClaimStates.PUSH_FAILED,
      "PUSH_FAILED",
      "retry",
      `Failed to push claim for ${conditions.taskId}. ` +
      `The task may have been claimed by another agent. ` +
      `Run 'taskforge next' to find the next available task, ` +
      `or retry with 'taskforge claim ${conditions.taskId}' after a brief wait.`,
      { taskId: conditions.taskId },
    );
  }

  // Claim succeeded — guidance depends on worktree state
  if (conditions.worktreeExists && conditions.worktreePath) {
    return success(
      ClaimStates.TASK_CLAIMED,
      "work_on_task",
      `Task ${conditions.taskId} claimed. Session: ${conditions.sessionId}. ` +
      `Worktree: ${conditions.worktreePath}. ` +
      `cd ${conditions.worktreePath} to begin work. ` +
      `Run 'taskforge prompt ${conditions.taskId}' for task context.`,
      { taskId: conditions.taskId, sessionId: conditions.sessionId, worktree: conditions.worktreePath },
    );
  }

  // Claim succeeded but no worktree — do NOT recommend start (would deadlock)
  return success(
    ClaimStates.TASK_CLAIMED,
    "request_human_input",
    `Task ${conditions.taskId} claimed. Session: ${conditions.sessionId}. ` +
    `Worktree creation did not complete. ` +
    `Valid next commands: taskforge doctor --json, taskforge inspect ${conditions.taskId} --json, ` +
    `or taskforge block ${conditions.taskId} "Claim succeeded but worktree creation failed" --category unsafe_operation --blocked-by human. ` +
    `Do NOT run 'taskforge start ${conditions.taskId}' — the task is already assigned.`,
    { taskId: conditions.taskId, sessionId: conditions.sessionId },
  );
}

// ── Start States ──────────────────────────────────────────────────

export const StartStates = {
  TASK_STARTED: "task_started",
  TASK_NOT_FOUND: "task_not_found",
  INVALID_STATUS: "invalid_status",
  ALREADY_ASSIGNED: "already_assigned",
  PUSH_FAILED: "push_failed",
  WORKTREE_FAILED: "worktree_failed",
  DOCTOR_LOCKED: "doctor_locked",
  OUTSTANDING_TASK: "outstanding_task",
  UNCOMMITTED_CHANGES: "uncommitted_changes",
} as const;

export function startStateMachine(
  conditions: {
    taskFound: boolean;
    taskStatus?: string;
    taskAssignee?: string;
    taskClaimedAt?: string;
    force?: boolean;
    doctorLocked: boolean;
    doctorReason?: string;
    hasOutstandingTask: boolean;
    outstandingTaskId?: string;
    uncommittedWorktrees?: { taskId: string; status: string; dirtyFiles: number }[];
    pushSucceeded: boolean;
    worktreeCreated: boolean;
    worktreePath?: string;
    sessionId?: string;
    taskId?: string;
    branch?: string;
  },
): CommandResult {
  if (conditions.doctorLocked) {
    return error(
      StartStates.DOCTOR_LOCKED,
      "DOCTOR_LOCKED",
      "wait",
      `System is in doctor recovery mode: ${conditions.doctorReason ?? "unknown"}. ` +
      `All agents are paused. Wait until recovery is complete.`,
    );
  }

  if (conditions.hasOutstandingTask && conditions.outstandingTaskId) {
    return error(
      StartStates.OUTSTANDING_TASK,
      "OUTSTANDING_TASK",
      "complete_current_then_next",
      `You still own task ${conditions.outstandingTaskId}. ` +
      `Close it first with 'taskforge done ${conditions.outstandingTaskId}'.`,
    );
  }

  if (conditions.uncommittedWorktrees && conditions.uncommittedWorktrees.length > 0) {
    const dirty = conditions.uncommittedWorktrees[0];
    const isBlocked = dirty.status === "Blocked";
    if (isBlocked) {
      return error(
        StartStates.UNCOMMITTED_CHANGES,
        "UNCOMMITTED_BLOCKED_TASK",
        "commit_then_next",
        `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s) and is in Blocked status. ` +
        `1. Commit your current changes: taskforge checkpoint -m "WIP: save progress on ${dirty.taskId}"\n` +
        `2. Look for the next task that resolves the block: taskforge next\n` +
        `3. If no resolving task is available, continue with the next available task.`,
        { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles },
      );
    }
    return error(
      StartStates.UNCOMMITTED_CHANGES,
      "UNCOMMITTED_CHANGES",
      "complete_current_then_next",
      `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s). ` +
      `Complete the current task before starting a new one. ` +
      `Run 'taskforge done ${dirty.taskId}' when ready, or 'taskforge checkpoint' to save progress.`,
      { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles },
    );
  }

  if (!conditions.taskFound) {
    return error(
      StartStates.TASK_NOT_FOUND,
      "TASK_NOT_FOUND",
      "request_human_input",
      `Task ${conditions.taskId} not found. ` +
      `Request human input to verify the task exists.`,
      { taskId: conditions.taskId },
    );
  }

  if (
    conditions.taskStatus !== "Ready" &&
    conditions.taskStatus !== "In Progress" &&
    conditions.taskStatus !== "Review" &&
    conditions.taskStatus !== "Verify"
  ) {
    return error(
      StartStates.INVALID_STATUS,
      "INVALID_STATUS",
      "request_human_input",
      `Cannot start task with status "${conditions.taskStatus}". ` +
      `Must be "Ready", "In Progress", "Review", or "Verify". ` +
      `Request human input to correct the task status.`,
      { taskId: conditions.taskId, status: conditions.taskStatus },
    );
  }

  if (conditions.taskAssignee && !conditions.force) {
    return error(
      StartStates.ALREADY_ASSIGNED,
      "ALREADY_ASSIGNED",
      "request_human_input",
      `Task ${conditions.taskId} is assigned to session "${conditions.taskAssignee}" ` +
      `since ${conditions.taskClaimedAt ?? "unknown"}. ` +
      `Normal agents may not use --force. ` +
      `Valid next commands: taskforge resume ${conditions.taskId}, taskforge inspect ${conditions.taskId} --json, ` +
      `taskforge doctor --json, or taskforge block ${conditions.taskId} "Task already assigned; human or doctor recovery required" --category unsafe_operation --blocked-by human.`,
      { taskId: conditions.taskId, assignee: conditions.taskAssignee },
    );
  }

  if (!conditions.pushSucceeded) {
    return error(
      StartStates.PUSH_FAILED,
      "PUSH_FAILED",
      "retry",
      `Failed to push claim for ${conditions.taskId}. ` +
      `The task may have been claimed by another agent. ` +
      `Run 'taskforge next' to find the next available task, ` +
      `or retry with 'taskforge start ${conditions.taskId}' after a brief wait.`,
      { taskId: conditions.taskId },
    );
  }

  if (!conditions.worktreeCreated) {
    return error(
      StartStates.WORKTREE_FAILED,
      "WORKTREE_FAILED",
      "request_human_input",
      `Could not create worktree for ${conditions.taskId}. ` +
      `Claim was pushed successfully but workspace creation failed. ` +
      `The task is claimed. Request human input to resolve the worktree issue, ` +
      `or run 'taskforge start ${conditions.taskId}' to retry.`,
      { taskId: conditions.taskId },
    );
  }

  return success(
    StartStates.TASK_STARTED,
    "work_on_task",
    `Task ${conditions.taskId} started. ` +
    `Worktree: ${conditions.worktreePath}. Branch: ${conditions.branch}. ` +
    `cd ${conditions.worktreePath} and begin work. ` +
    `Read TASKFORGE.md and AGENTS.md for guidance.`,
    {
      taskId: conditions.taskId,
      sessionId: conditions.sessionId,
      worktree: conditions.worktreePath,
      branch: conditions.branch,
    },
  );
}

// ── Checkpoint States ─────────────────────────────────────────────

export const CheckpointStates = {
  CHANGES_COMMIT: "changes_committed",
  NO_CHANGES: "no_changes",
  COMMIT_FAILED: "commit_failed",
  NOT_IN_WORKTREE: "not_in_worktree",
} as const;

export function checkpointStateMachine(
  conditions: {
    hasChanges: boolean;
    commitSucceeded: boolean;
    inWorktree: boolean;
    taskId?: string;
    errorMessage?: string;
  },
): CommandResult {
  if (!conditions.inWorktree) {
    return error(
      CheckpointStates.NOT_IN_WORKTREE,
      "NOT_IN_WORKTREE",
      "request_human_input",
      "Not in a task worktree. Run 'taskforge start TASK-ID' to create a worktree first.",
    );
  }

  if (!conditions.hasChanges) {
    return error(
      CheckpointStates.NO_CHANGES,
      "NO_CHANGES",
      "work_on_task",
      "No changes to commit. Continue working on the task, then run 'taskforge checkpoint' again.",
    );
  }

  if (!conditions.commitSucceeded) {
    return error(
      CheckpointStates.COMMIT_FAILED,
      "COMMIT_FAILED",
      "request_human_input",
      `Failed to commit changes: ${conditions.errorMessage ?? "unknown error"}. ` +
      `If the correct action cannot be cleanly inferred, request human input.`,
      { taskId: conditions.taskId },
    );
  }

  return success(
    CheckpointStates.CHANGES_COMMIT,
    "run_gates",
    `Changes committed for ${conditions.taskId}. ` +
    `Run 'taskforge gates' to verify, then 'taskforge submit' to create a PR.`,
    { taskId: conditions.taskId },
  );
}

// ── Gates States ──────────────────────────────────────────────────

export const GatesStates = {
  ALL_PASSED: "all_passed",
  SOME_FAILED: "some_failed",
  NO_GATES: "no_gates",
} as const;

export function gatesStateMachine(
  conditions: {
    totalGates: number;
    passedGates: number;
    failedGates: { name: string; command: string }[];
  },
): CommandResult {
  if (conditions.totalGates === 0) {
    return success(
      GatesStates.NO_GATES,
      "create_pr",
      "No gates configured. Proceed to create a PR with 'taskforge submit'.",
    );
  }

  if (conditions.failedGates.length > 0) {
    const failedNames = conditions.failedGates.map((g) => g.name).join(", ");
    return error(
      GatesStates.SOME_FAILED,
      "GATE_FAILURE",
      "work_on_task",
      `${conditions.failedGates.length}/${conditions.totalGates} gate(s) failed: ${failedNames}. ` +
      `Fix the issues and re-run 'taskforge gates'. ` +
      `If gates cannot be satisfied, request human input.`,
      { failedGates: conditions.failedGates },
    );
  }

  return success(
    GatesStates.ALL_PASSED,
    "create_pr",
    `All ${conditions.totalGates} gate(s) passed. ` +
    `Run 'taskforge submit' to create a pull request.`,
  );
}

// ── Submit/PR States ──────────────────────────────────────────────

export const SubmitStates = {
  PR_CREATED: "pr_created",
  PR_FAILED: "pr_failed",
  PR_MANUAL: "pr_manual",
  NO_CHANGES: "no_changes",
} as const;

export function submitStateMachine(
  conditions: {
    prCreated: boolean;
    prNumber?: number;
    prUrl?: string;
    githubConfigured: boolean;
    errorMessage?: string;
    taskId?: string;
  },
): CommandResult {
  if (conditions.prCreated && conditions.prNumber) {
    return success(
      SubmitStates.PR_CREATED,
      "complete_task",
      `Pull request created: #${conditions.prNumber} (${conditions.prUrl ?? "no URL"}). ` +
      `Run 'taskforge done ${conditions.taskId}' to mark the task complete.`,
      { taskId: conditions.taskId, prNumber: conditions.prNumber, prUrl: conditions.prUrl },
    );
  }

  if (conditions.githubConfigured && !conditions.prCreated) {
    return error(
      SubmitStates.PR_FAILED,
      "PR_FAILED",
      "request_human_input",
      `Failed to create pull request: ${conditions.errorMessage ?? "unknown error"}. ` +
      `If the correct action cannot be cleanly inferred, request human input.`,
      { taskId: conditions.taskId },
    );
  }

  if (!conditions.githubConfigured) {
    return success(
      SubmitStates.PR_MANUAL,
      "complete_task",
      `GitHub is not configured. Create the PR manually, then run 'taskforge done ${conditions.taskId}'.`,
      { taskId: conditions.taskId },
    );
  }

  return error(
    SubmitStates.NO_CHANGES,
    "NO_CHANGES",
    "work_on_task",
    "No changes to submit. Continue working on the task.",
  );
}

// ── Done States ───────────────────────────────────────────────────

export const DoneStates = {
  TASK_DONE: "task_done",
  INVALID_TRANSITION: "invalid_transition",
  GATES_FAILED: "gates_failed",
  OWNERSHIP_MISMATCH: "ownership_mismatch",
  CONTROL_FILE_CHANGED: "control_file_changed",
  AC_MISSING: "ac_missing",
  AC_BLANK: "ac_blank",
  AC_UNCHECKED: "ac_unchecked",
  WORKTREE_DIRTY: "worktree_dirty",
  BRANCH_UNPUSHED: "branch_unpushed",
} as const;

export function doneStateMachine(
  conditions: {
    validTransition: boolean;
    gatesPassed: boolean;
    ownershipMatch: boolean;
    controlFileHashMatch: boolean;
    hasAcSection: boolean;
    hasBlankAc: boolean;
    hasUncheckedAc: boolean;
    worktreeClean: boolean;
    branchPushed: boolean;
    dirtyFiles?: string[];
    commitsAhead?: number;
    taskId?: string;
    currentStatus?: string;
  },
): CommandResult {
  if (!conditions.validTransition) {
    return error(
      DoneStates.INVALID_TRANSITION,
      "INVALID_TRANSITION",
      "request_human_input",
      `Cannot transition from "${conditions.currentStatus}" to "Done". ` +
      `Request human input to correct the task status.`,
      { taskId: conditions.taskId, status: conditions.currentStatus },
    );
  }

  if (!conditions.gatesPassed) {
    return error(
      DoneStates.GATES_FAILED,
      "GATES_FAILED",
      "work_on_task",
      `Verification gates failed. Fix the issues and re-run 'taskforge gates', ` +
      `then try 'taskforge done ${conditions.taskId}' again.`,
      { taskId: conditions.taskId },
    );
  }

  if (!conditions.ownershipMatch) {
    return error(
      DoneStates.OWNERSHIP_MISMATCH,
      "OWNERSHIP_MISMATCH",
      "request_human_input",
      `Task ${conditions.taskId} is not owned by the current session. ` +
      `Request human input to resolve the ownership conflict.`,
      { taskId: conditions.taskId },
    );
  }

  if (!conditions.worktreeClean) {
    const fileCount = conditions.dirtyFiles?.length ?? 0;
    const fileList = conditions.dirtyFiles && conditions.dirtyFiles.length <= 5
      ? `: ${conditions.dirtyFiles.join(", ")}`
      : conditions.dirtyFiles && conditions.dirtyFiles.length > 5
        ? ` (showing first 5): ${conditions.dirtyFiles.slice(0, 5).join(", ")}...`
        : "";
    return error(
      DoneStates.WORKTREE_DIRTY,
      "WORKTREE_DIRTY",
      "work_on_task",
      `Task ${conditions.taskId} has ${fileCount} uncommitted file(s) in the worktree${fileList}. ` +
      `Done requires a clean worktree. ` +
      `Run 'taskforge checkpoint -m "your message"' to commit changes, ` +
      `then try 'taskforge done ${conditions.taskId}' again.`,
      { taskId: conditions.taskId, dirtyFiles: conditions.dirtyFiles },
    );
  }

  if (!conditions.branchPushed) {
    const ahead = conditions.commitsAhead ?? 0;
    return error(
      DoneStates.BRANCH_UNPUSHED,
      "BRANCH_UNPUSHED",
      "work_on_task",
      `Task ${conditions.taskId} has ${ahead} unpushed commit(s). ` +
      `Done requires all commits to be pushed. ` +
      `Run 'taskforge submit' to push and create a PR, ` +
      `then try 'taskforge done ${conditions.taskId}' again.`,
      { taskId: conditions.taskId, commitsAhead: conditions.commitsAhead },
    );
  }

  if (!conditions.controlFileHashMatch) {
    return error(
      DoneStates.CONTROL_FILE_CHANGED,
      "CONTROL_FILE_CHANGED",
      "request_human_input",
      `Control files (AGENTS.md, TASKFORGE.md, etc.) have changed since task start. ` +
      `Re-read the updated control files, verify the completed work still complies, and then retry ` +
      `'taskforge done ${conditions.taskId}'. No recommit is required if the worktree is already clean ` +
      `and the branch is already pushed. Block for human review only if the updated control files change ` +
      `the expected outcome or you cannot verify compliance.`,
      { taskId: conditions.taskId },
    );
  }

  if (!conditions.hasAcSection) {
    return error(
      DoneStates.AC_MISSING,
      "MISSING_ACCEPTANCE_CRITERIA",
      "work_on_task",
      `Task ${conditions.taskId} is missing an "## Acceptance Criteria" section. ` +
      `Add acceptance criteria to the task file before marking done.`,
      { taskId: conditions.taskId },
    );
  }

  if (conditions.hasBlankAc) {
    return error(
      DoneStates.AC_BLANK,
      "BLANK_ACCEPTANCE_CRITERIA",
      "work_on_task",
      `Task ${conditions.taskId} has blank acceptance criteria items. ` +
      `Replace blank checkboxes with verifiable conditions.`,
      { taskId: conditions.taskId },
    );
  }

  if (conditions.hasUncheckedAc) {
    return error(
      DoneStates.AC_UNCHECKED,
      "UNCHECKED_ACCEPTANCE_CRITERIA",
      "work_on_task",
      `Task ${conditions.taskId} has unchecked acceptance criteria. ` +
      `Check off each criterion with evidence of how it was satisfied.`,
      { taskId: conditions.taskId },
    );
  }

  return success(
    DoneStates.TASK_DONE,
    "none",
    `Task ${conditions.taskId} marked as Done. ` +
    `Run 'taskforge next' to find the next task.`,
    { taskId: conditions.taskId },
  );
}

// ── New Task Creation States ──────────────────────────────────────

export const NewStates = {
  TASK_CREATED: "task_created",
  PUSH_FAILED: "push_failed",
  WRITE_FAILED: "write_failed",
} as const;

export function newStateMachine(
  conditions: {
    writeSucceeded: boolean;
    pushSucceeded: boolean;
    taskId?: string;
    filePath?: string;
    errorMessage?: string;
  },
): CommandResult {
  if (!conditions.writeSucceeded) {
    return error(
      NewStates.WRITE_FAILED,
      "WRITE_FAILED",
      "request_human_input",
      `Failed to create task file: ${conditions.errorMessage ?? "unknown error"}. ` +
      `Request human input to resolve.`,
    );
  }

  if (!conditions.pushSucceeded) {
    return error(
      NewStates.PUSH_FAILED,
      "PUSH_FAILED",
      "request_human_input",
      `Task ${conditions.taskId} was created locally but failed to push to remote. ` +
      `The task may not be visible to other agents. ` +
      `Run 'taskforge submit' or request human input to push the task-state branch.`,
      { taskId: conditions.taskId, filePath: conditions.filePath },
    );
  }

  return success(
    NewStates.TASK_CREATED,
    "none",
    `Created ${conditions.taskId}: ${conditions.filePath}. ` +
    `Run 'taskforge next' to see it in the queue.`,
    { taskId: conditions.taskId, filePath: conditions.filePath },
  );
}
