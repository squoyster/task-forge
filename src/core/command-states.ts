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

export type Safety = "safe" | "requires_human" | "doctor_only" | "blocked";

export interface NextAction {
  command: string;
  reason: string;
  safety: Safety;
  preferred: boolean;
  stateTransition?: { from: string; to: string };
}

export interface CommandStateRule {
  command: string;
  allowedStatuses?: string[];
  forbiddenStatuses?: string[];
  requiresTask?: boolean;
  requiresWorktree?: boolean;
  requiresNoDoctorLock?: boolean;
  forbidsAgentForce?: boolean;
  nextActions: NextAction[];
  errorActions: Record<string, NextAction[]>;
}

export type LegacyNextAction =
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
  /** Legacy single action consumed by existing command handlers */
  nextAction: LegacyNextAction;
  /** Spec-shaped next actions for newer callers */
  nextActions: NextAction[];
  /** Human-readable guidance for the next step */
  guidance: string;
  /** Machine-readable error code (only set when ok is false) */
  errorCode?: string;
  /** Additional context for the result */
  context?: Record<string, unknown>;
}

function legacyNextActionToSpecAction(nextAction: LegacyNextAction, context: Record<string, unknown> = {}): NextAction {
  const taskId = typeof context.taskId === "string" ? context.taskId : "TASK-ID";
  const actions: Record<LegacyNextAction, NextAction> = {
    start_task: workAction(`taskforge start ${taskId}`, "Start the selected task.", true, { from: "Ready", to: "In Progress" }),
    create_worktree: workAction(`taskforge start ${taskId}`, "Create or repair the task worktree.", true),
    work_on_task: workAction(`taskforge checkpoint ${taskId} --message "Describe progress"`, "Continue implementation and checkpoint meaningful progress.", true),
    commit_changes: workAction(`taskforge checkpoint ${taskId} --message "Describe progress"`, "Commit task changes.", true),
    run_gates: workAction("taskforge gates --json", "Run verification gates.", true),
    create_pr: workAction(`taskforge submit ${taskId}`, "Push the branch and create or update the PR.", true),
    complete_task: workAction(`taskforge done ${taskId}`, "Complete the task after verification.", true, { from: "Verify", to: "Done" }),
    block_task: workAction(`taskforge block ${taskId} "Blocked"`, "Record why the task cannot proceed.", true, { from: "In Progress", to: "Blocked" }),
    release_task: workAction(`taskforge release ${taskId}`, "Release the task claim.", true, { from: "In Progress", to: "Ready" }),
    resolve_dependency: workAction("taskforge next", "Work on the unmet dependency first.", true),
    commit_then_next: workAction(`taskforge checkpoint ${taskId} --message "Save progress"`, "Commit current changes before selecting another task.", true),
    complete_current_then_next: workAction(`taskforge done ${taskId}`, "Close the current task before selecting another task.", true),
    create_task_for_error: closureTaskAction("unknown", "UNHANDLED_ERROR", context),
    request_human_input: humanAction(`taskforge inspect ${taskId} --json`, "Request or gather human review before continuing.", true),
    retry: workAction(`taskforge inspect ${taskId} --json`, "Inspect state and retry the command.", true),
    wait: blockedAction("taskforge doctor --check", "Wait while doctor recovery is active.", true),
    none: workAction("taskforge next", "No follow-up required beyond selecting the next task.", true),
  };
  return actions[nextAction];
}

/**
 * Build a success result with guidance for the next step.
 */
export function success(
  state: string,
  nextAction: LegacyNextAction,
  guidance: string,
  context?: Record<string, unknown>,
): CommandResult {
  return { ok: true, state, nextAction, nextActions: [legacyNextActionToSpecAction(nextAction, context)], guidance, context };
}

/**
 * Build an error result with recovery guidance.
 */
export function error(
  state: string,
  errorCode: string,
  nextAction: LegacyNextAction,
  guidance: string,
  context?: Record<string, unknown>,
): CommandResult {
  return { ok: false, state, errorCode, nextAction, nextActions: [legacyNextActionToSpecAction(nextAction, context)], guidance, context };
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

function taskCommand(template: string, context: Record<string, unknown>): string {
  const taskId = typeof context.taskId === "string" ? context.taskId : "TASK-ID";
  return template.replaceAll("{taskId}", taskId);
}

function action(
  command: string,
  reason: string,
  safety: Safety = "safe",
  preferred = false,
  stateTransition?: { from: string; to: string },
): NextAction {
  return { command, reason, safety, preferred, stateTransition };
}

function workAction(command: string, reason: string, preferred = false, stateTransition?: { from: string; to: string }): NextAction {
  return action(command, reason, "safe", preferred, stateTransition);
}

function humanAction(command: string, reason: string, preferred = false): NextAction {
  return action(command, reason, "requires_human", preferred);
}

function doctorAction(command: string, reason: string, preferred = false): NextAction {
  return action(command, reason, "doctor_only", preferred);
}

function blockedAction(command: string, reason: string, preferred = false): NextAction {
  return action(command, reason, "blocked", preferred);
}

function closureTaskAction(commandName: string, errorCode: string, context: Record<string, unknown>): NextAction {
  const taskId = typeof context.taskId === "string" ? ` for ${context.taskId}` : "";
  return humanAction(
    `taskforge new "Investigate ${commandName} ${errorCode}${taskId}" --type Bug --priority P2`,
    "Create a closure task for an unmapped command error before guessing recovery steps.",
    true,
  );
}

const commonErrorActions: Record<string, NextAction[]> = {
  TASK_NOT_FOUND: [
    humanAction("taskforge list --json", "Verify the task exists and the task-state branch is current.", true),
  ],
  DOCTOR_LOCKED: [
    blockedAction("taskforge doctor --check", "Inspect doctor recovery state; normal agents must wait.", true),
  ],
  UNCOMMITTED_CHANGES: [
    workAction("taskforge checkpoint {taskId} --message \"Save progress\"", "Commit the current task changes before continuing.", true),
  ],
  UNCOMMITTED_BLOCKED_TASK: [
    workAction("taskforge checkpoint {taskId} --message \"WIP: save blocked progress\"", "Preserve blocked task work before selecting another task.", true),
  ],
  OUTSTANDING_TASK: [
    workAction("taskforge done {taskId}", "Close the outstanding owned task before taking another one.", true),
    workAction("taskforge release {taskId}", "Release the outstanding task if it cannot be completed now."),
  ],
  OWNERSHIP_MISMATCH: [
    workAction("taskforge inspect {taskId} --json", "Inspect task ownership and workspace state.", true),
    humanAction("taskforge block {taskId} \"Ownership mismatch\" --category unsafe_operation --blocked-by human", "Escalate ownership drift for review."),
  ],
  INVALID_STATUS: [
    humanAction("taskforge inspect {taskId} --json", "Inspect the current task status before changing workflow state.", true),
  ],
  INVALID_TRANSITION: [
    humanAction("taskforge inspect {taskId} --json", "Inspect the task status and choose an allowed transition.", true),
  ],
  PUSH_FAILED: [
    workAction("taskforge inspect {taskId} --json", "Inspect branch and ownership state before retrying.", true),
    workAction("taskforge submit {taskId}", "Retry the push after confirming the branch state."),
  ],
  PR_FAILED: [
    humanAction("taskforge pr {taskId}", "Retry PR creation after credentials or remote state are repaired.", true),
  ],
  NO_CHANGES: [
    workAction("taskforge diff {taskId}", "Review the task diff and continue implementation if needed.", true),
  ],
  FORCE_REQUIRES_AUTHORITY: [
    doctorAction("taskforge doctor --check", "Force operations require doctor authority.", true),
    humanAction("taskforge block {taskId} \"Force operation requires human approval\" --category unsafe_operation --blocked-by human", "Escalate force intent instead of bypassing safety."),
  ],
};

function withCommonErrors(errorActions: Record<string, NextAction[]> = {}): Record<string, NextAction[]> {
  return { ...commonErrorActions, ...errorActions };
}

function rule(config: CommandStateRule): CommandStateRule {
  return config;
}

export const COMMAND_STATE_REGISTRY: Record<string, CommandStateRule> = {
  init: rule({
    command: "init",
    requiresNoDoctorLock: false,
    forbidsAgentForce: true,
    nextActions: [
      workAction("taskforge next", "Select the next available task after initialization.", true),
      workAction("taskforge doctor --check", "Verify repository health after initialization."),
    ],
    errorActions: withCommonErrors({
      FORCE_REQUIRES_AUTHORITY: [
        doctorAction("taskforge init --force", "Repair initialization artifacts only under doctor authority.", true),
      ],
    }),
  }),
  next: rule({
    command: "next",
    requiresNoDoctorLock: true,
    nextActions: [
      workAction("taskforge start {taskId}", "Start the selected ready task.", true, { from: "Ready", to: "In Progress" }),
    ],
    errorActions: withCommonErrors({
      NO_ACTIONABLE_TASKS: [
        humanAction("taskforge list --json", "Review blocked, deferred, or underspecified tasks.", true),
      ],
    }),
  }),
  start: rule({
    command: "start",
    allowedStatuses: ["Ready", "In Progress"],
    requiresTask: true,
    requiresNoDoctorLock: true,
    forbidsAgentForce: true,
    nextActions: [
      workAction("opencode", "Begin work in the created task worktree.", true, { from: "Ready", to: "In Progress" }),
      workAction("taskforge checkpoint {taskId} --message \"Describe progress\"", "Save completed work after implementation."),
    ],
    errorActions: withCommonErrors({
      ALREADY_ASSIGNED: [
        workAction("taskforge resume {taskId}", "Resume the existing claimed workspace if it belongs to this task.", true),
        humanAction("taskforge block {taskId} \"Task already assigned\" --category unsafe_operation --blocked-by human", "Escalate claim conflicts."),
      ],
      WORKTREE_FAILED: [
        humanAction("taskforge doctor --check", "Diagnose worktree creation failure.", true),
      ],
    }),
  }),
  status: rule({
    command: "status",
    nextActions: [
      workAction("taskforge next", "Choose the next actionable task.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  summary: rule({
    command: "summary",
    nextActions: [
      workAction("taskforge next", "Continue with the recommended task.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  gates: rule({
    command: "gates",
    nextActions: [
      workAction("taskforge submit {taskId}", "Submit after all gates pass.", true),
    ],
    errorActions: withCommonErrors({
      GATE_FAILURE: [
        workAction("taskforge diff {taskId}", "Inspect failing changes and repair them.", true),
        humanAction("taskforge block {taskId} \"Gates failing\" --category test_failure --blocked-by agent", "Block if the gate failure cannot be resolved locally."),
      ],
    }),
  }),
  block: rule({
    command: "block",
    requiresTask: true,
    nextActions: [
      workAction("taskforge next", "Find another task after recording the blocker.", true, { from: "In Progress", to: "Blocked" }),
    ],
    errorActions: withCommonErrors(),
  }),
  done: rule({
    command: "done",
    allowedStatuses: ["Review", "Verify"],
    requiresTask: true,
    requiresWorktree: true,
    nextActions: [
      workAction("taskforge next", "Select the next task after terminal completion.", true, { from: "Verify", to: "Done" }),
    ],
    errorActions: withCommonErrors({
      WORKTREE_DIRTY: [
        workAction("taskforge checkpoint {taskId} --message \"Save completion work\"", "Commit remaining work before marking done.", true),
      ],
      BRANCH_UNPUSHED: [
        workAction("taskforge submit {taskId}", "Push the task branch before marking done.", true),
      ],
      CONTROL_FILE_CHANGED: [
        humanAction("taskforge inspect {taskId} --json", "Re-read updated control files and confirm compliance.", true),
      ],
      MISSING_ACCEPTANCE_CRITERIA: [
        workAction("taskforge update {taskId} --field acceptanceCriteria --value \"...\"", "Add verifiable acceptance criteria before completion.", true),
      ],
      BLANK_ACCEPTANCE_CRITERIA: [
        workAction("taskforge update {taskId} --field acceptanceCriteria --value \"...\"", "Replace blank acceptance criteria before completion.", true),
      ],
      UNCHECKED_ACCEPTANCE_CRITERIA: [
        workAction("taskforge update {taskId} --field acceptanceCriteria --value \"...\"", "Check off verified acceptance criteria before completion.", true),
      ],
    }),
  }),
  sync: rule({
    command: "sync",
    nextActions: [
      workAction("taskforge next", "Continue after external issue tracker sync.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  list: rule({
    command: "list",
    nextActions: [
      workAction("taskforge inspect {taskId} --json", "Inspect a selected task from the list.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  promote: rule({
    command: "promote",
    requiresTask: true,
    nextActions: [
      workAction("taskforge promote {taskId}", "Advance to the next valid status when appropriate.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  unlock: rule({
    command: "unlock",
    requiresTask: true,
    forbidsAgentForce: true,
    nextActions: [
      humanAction("taskforge inspect {taskId} --json", "Inspect unlock result and task ownership.", true),
    ],
    errorActions: withCommonErrors({
      FORCE_REQUIRES_AUTHORITY: [
        doctorAction("taskforge unlock {taskId} --force", "Force unlock is doctor-only.", true),
      ],
    }),
  }),
  sweep: rule({
    command: "sweep",
    forbidsAgentForce: true,
    nextActions: [
      workAction("taskforge next", "Continue after stale task sweep.", true),
    ],
    errorActions: withCommonErrors({
      FORCE_REQUIRES_AUTHORITY: [
        doctorAction("taskforge sweep --force", "Force sweeping skips classification and is doctor-only.", true),
      ],
    }),
  }),
  heartbeat: rule({
    command: "heartbeat",
    requiresTask: true,
    forbidsAgentForce: true,
    nextActions: [
      workAction("taskforge checkpoint {taskId} --message \"Describe progress\"", "Continue work and checkpoint meaningful progress.", true),
    ],
    errorActions: withCommonErrors({
      FORCE_REQUIRES_AUTHORITY: [
        doctorAction("taskforge heartbeat {taskId} --force", "Force heartbeat bypasses ownership and is doctor-only.", true),
      ],
    }),
  }),
  agents: rule({
    command: "agents",
    nextActions: [
      workAction("taskforge next", "Continue task selection after reviewing agent state.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  inspect: rule({
    command: "inspect",
    requiresTask: true,
    nextActions: [
      workAction("taskforge resume {taskId}", "Resume the inspected task workspace when work should continue.", true),
      workAction("taskforge next", "Return to queue selection if no action is needed."),
    ],
    errorActions: withCommonErrors(),
  }),
  claim: rule({
    command: "claim",
    allowedStatuses: ["Ready", "In Progress"],
    requiresTask: true,
    requiresNoDoctorLock: true,
    forbidsAgentForce: true,
    nextActions: [
      workAction("taskforge resume {taskId}", "Enter the claimed workspace if one exists.", true),
    ],
    errorActions: withCommonErrors({
      ALREADY_CLAIMED: [
        humanAction("taskforge inspect {taskId} --json", "Inspect ownership before resolving claim conflicts.", true),
        humanAction("taskforge block {taskId} \"Already claimed\" --category unsafe_operation --blocked-by human", "Escalate claim conflicts."),
      ],
    }),
  }),
  report: rule({
    command: "report",
    requiresTask: true,
    nextActions: [
      workAction("taskforge promote {taskId} --to Submitted", "Submit after implementation report is accepted.", true, { from: "Implementation Complete", to: "Submitted" }),
    ],
    errorActions: withCommonErrors(),
  }),
  cleanup: rule({
    command: "cleanup",
    requiresTask: true,
    forbidsAgentForce: true,
    nextActions: [
      workAction("taskforge next", "Continue after workspace cleanup.", true),
    ],
    errorActions: withCommonErrors({
      FORCE_REQUIRES_AUTHORITY: [
        doctorAction("taskforge cleanup {taskId} --force", "Force cleanup skips safety checks and is doctor-only.", true),
      ],
    }),
  }),
  new: rule({
    command: "new",
    nextActions: [
      workAction("taskforge next", "Return to queue selection after task creation.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  update: rule({
    command: "update",
    requiresTask: true,
    nextActions: [
      workAction("taskforge inspect {taskId} --json", "Inspect the updated task document.", true),
      workAction("taskforge next", "Return to queue selection after task metadata updates."),
    ],
    errorActions: withCommonErrors({
      PROTECTED_FIELD: [
        humanAction("taskforge inspect {taskId} --json", "Protected fields are system-owned; inspect state before deciding on recovery.", true),
      ],
      SPEC_HASH_MISMATCH: [
        workAction("taskforge inspect {taskId} --json", "Reload current task state before retrying the update.", true),
      ],
    }),
  }),
  prompt: rule({
    command: "prompt",
    requiresTask: true,
    nextActions: [
      workAction("opencode", "Use the prompt packet to continue task work.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  resume: rule({
    command: "resume",
    requiresTask: true,
    requiresWorktree: true,
    nextActions: [
      workAction("taskforge checkpoint {taskId} --message \"Describe progress\"", "Save progress after resuming work.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  doctor: rule({
    command: "doctor",
    nextActions: [
      workAction("taskforge next", "Continue normal workflow if doctor checks pass.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "config-validate": rule({
    command: "config-validate",
    nextActions: [
      workAction("taskforge next", "Continue after config validation.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  release: rule({
    command: "release",
    requiresTask: true,
    nextActions: [
      workAction("taskforge next", "Select another task after releasing the claim.", true, { from: "In Progress", to: "Ready" }),
    ],
    errorActions: withCommonErrors(),
  }),
  reject: rule({
    command: "reject",
    requiresTask: true,
    nextActions: [
      workAction("taskforge next", "Continue after terminal rejection.", true, { from: "Ready", to: "Rejected" }),
    ],
    errorActions: withCommonErrors(),
  }),
  "validate-state": rule({
    command: "validate-state",
    nextActions: [
      workAction("taskforge next", "Continue if state validation passes.", true),
      humanAction("taskforge doctor --check", "Diagnose state issues if validation fails."),
    ],
    errorActions: withCommonErrors(),
  }),
  audit: rule({
    command: "audit",
    requiresTask: true,
    nextActions: [
      workAction("taskforge inspect {taskId} --json", "Inspect task state after audit review.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  transcript: rule({
    command: "transcript",
    requiresTask: true,
    nextActions: [
      workAction("taskforge inspect {taskId} --json", "Inspect task state after transcript review.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  timeline: rule({
    command: "timeline",
    requiresTask: true,
    nextActions: [
      workAction("taskforge inspect {taskId} --json", "Inspect task state after timeline review.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "ac-check": rule({
    command: "ac-check",
    nextActions: [
      workAction("taskforge update {taskId} --field acceptanceCriteria --value \"...\"", "Repair acceptance criteria when the scan reports issues.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  diff: rule({
    command: "diff",
    requiresTask: true,
    requiresWorktree: true,
    nextActions: [
      workAction("taskforge checkpoint {taskId} --message \"Describe progress\"", "Checkpoint reviewed changes.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  checkpoint: rule({
    command: "checkpoint",
    requiresTask: true,
    requiresWorktree: true,
    nextActions: [
      workAction("taskforge gates --json", "Run verification gates after checkpointing.", true),
      workAction("taskforge submit {taskId}", "Submit when verification is complete."),
    ],
    errorActions: withCommonErrors({
      CHECKPOINT_AUDIT_WRITE_FAILED: [
        workAction("taskforge inspect {taskId} --json", "Inspect partial checkpoint state before continuing.", true),
        humanAction("taskforge doctor --check", "Diagnose audit write failures."),
      ],
    }),
  }),
  submit: rule({
    command: "submit",
    requiresTask: true,
    requiresWorktree: true,
    nextActions: [
      workAction("taskforge pr {taskId}", "Create or update the pull request after push.", true),
      workAction("taskforge report {taskId} --complete", "Move implementation to verification after submission."),
    ],
    errorActions: withCommonErrors({
      MERGE_CONFLICT: [
        workAction("taskforge diff {taskId}", "Inspect conflicting changes before merging main.", true),
        humanAction("taskforge block {taskId} \"Merge conflict\" --category merge_conflict --blocked-by agent", "Block if the merge conflict cannot be resolved locally."),
      ],
    }),
  }),
  pr: rule({
    command: "pr",
    requiresTask: true,
    nextActions: [
      workAction("taskforge report {taskId} --complete", "Advance task after PR creation.", true),
    ],
    errorActions: withCommonErrors({
      PR_FAILED: [
        humanAction("gh auth status", "Verify GitHub authentication before retrying PR creation.", true),
      ],
    }),
  }),
  mcp: rule({
    command: "mcp",
    nextActions: [
      workAction("taskforge next", "Continue task workflow after MCP server use.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "guard status": rule({
    command: "guard status",
    nextActions: [
      workAction("taskforge next", "Continue after checking guard status.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "guard override": rule({
    command: "guard override",
    requiresTask: true,
    forbidsAgentForce: true,
    nextActions: [
      doctorAction("taskforge guard override {taskId} <command> <reason>", "Guard overrides are doctor-only recovery actions.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps scan": rule({
    command: "deps scan",
    nextActions: [
      workAction("taskforge deps summary", "Summarize dependency findings after scan.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps audit": rule({
    command: "deps audit",
    nextActions: [
      workAction("taskforge deps create-tasks", "Create dependency remediation tasks for actionable findings.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps outdated": rule({
    command: "deps outdated",
    nextActions: [
      workAction("taskforge deps plan", "Plan safe dependency updates.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps deprecated": rule({
    command: "deps deprecated",
    nextActions: [
      workAction("taskforge deps plan", "Plan replacements for deprecated dependencies.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps plan": rule({
    command: "deps plan",
    nextActions: [
      workAction("taskforge deps create-tasks", "Create tasks from the remediation plan.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps create-tasks": rule({
    command: "deps create-tasks",
    nextActions: [
      workAction("taskforge next", "Pick up created dependency remediation tasks.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps pr": rule({
    command: "deps pr",
    nextActions: [
      workAction("taskforge deps summary", "Summarize dependency PR results.", true),
    ],
    errorActions: withCommonErrors(),
  }),
  "deps summary": rule({
    command: "deps summary",
    nextActions: [
      workAction("taskforge next", "Continue workflow after reviewing dependency health.", true),
    ],
    errorActions: withCommonErrors(),
  }),
};

export function getNextActions(commandName: string, context: Record<string, unknown> = {}): NextAction[] {
  const rule = COMMAND_STATE_REGISTRY[commandName];
  if (!rule) {
    return [closureTaskAction(commandName, "UNKNOWN_COMMAND", context)];
  }
  return rule.nextActions.map((next) => ({
    ...next,
    command: taskCommand(next.command, context),
  }));
}

export function getErrorGuidance(commandName: string, errorCode: string, context: Record<string, unknown> = {}): NextAction[] {
  const rule = COMMAND_STATE_REGISTRY[commandName];
  if (!rule) {
    return [closureTaskAction(commandName, errorCode, context)];
  }
  const actions = rule.errorActions[errorCode] ?? rule.errorActions.UNHANDLED_ERROR;
  if (!actions) {
    return [closureTaskAction(commandName, errorCode, context)];
  }
  return actions.map((next) => ({
    ...next,
    command: taskCommand(next.command, context),
  }));
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
    forceRejected?: boolean;
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

  if (!conditions.gatesPassed && conditions.forceRejected) {
    return error(
      DoneStates.GATES_FAILED,
      "FORCE_REJECTED",
      "work_on_task",
      `Verification gates failed and --force is not available for agent authority. ` +
      `Fix the gate failures and re-run 'taskforge gates', ` +
      `then try 'taskforge done ${conditions.taskId}' again. ` +
      `Alternatively, block for human review: taskforge block ${conditions.taskId} "Gates failed; requires human review" --blocked-by human.`,
      { taskId: conditions.taskId },
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
       `Run 'taskforge sync' to publish pending task-state changes, or request human input.`,
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
