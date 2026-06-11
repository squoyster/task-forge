import type {
  TaskForgeCommandResult,
  ValidNextCommand,
  CommandStatus,
  NextAction,
} from "./command-result.js";
import { STANDARD_PROHIBITED_ACTIONS } from "./command-result.js";
import { resolveAuthority } from "./authority.js";
import { getValidNextCommands } from "./next-command-maps.js";

interface BuilderOptions {
  command: string;
  taskId?: string;
  worktree?: string;
  branch?: string;
  sessionId?: string;
  guidance?: string;
  duration?: number;
}

function safetyForAllowedActor(allowedFor: ValidNextCommand["allowedFor"]): NextAction["safety"] {
  switch (allowedFor) {
    case "human":
      return "requires_human";
    case "doctor":
      return "doctor_only";
    default:
      return "safe";
  }
}

function actionFromNextCommand(command: ValidNextCommand, taskId?: string): NextAction {
  return {
    command: taskId ? command.command.replaceAll("<TASK-ID>", taskId) : command.command,
    reason: command.purpose,
    safety: safetyForAllowedActor(command.allowedFor),
    preferred: command.priority === 1,
  };
}

function actionFromRecoveryStep(step: string): NextAction {
  return {
    command: step,
    reason: "Follow recovery guidance for this command result.",
    safety: "safe",
    preferred: false,
  };
}

function baseResult(status: CommandStatus, ok: boolean, opts: BuilderOptions): TaskForgeCommandResult {
  const authority = resolveAuthority();
  const isNormalAgent = authority === "agent" || !authority;
  const defaultNextCommands = getValidNextCommands(opts.command, status);

  return {
    ok,
    status,
    metadata: {
      command: opts.command,
      timestamp: new Date().toISOString(),
      duration: opts.duration,
      sessionId: opts.sessionId,
    },
    context: {
      taskId: opts.taskId,
      worktree: opts.worktree,
      branch: opts.branch,
    },
    agentPrompt: {
      role: "implementer",
    },
    validNextCommands: defaultNextCommands,
    nextActions: defaultNextCommands.map((command) => actionFromNextCommand(command, opts.taskId)),
    todoMerge: { required: false, items: [] },
    contextCleanup: { required: false, actions: [] },
    prohibitedActions: isNormalAgent ? [...STANDARD_PROHIBITED_ACTIONS] : [],
    recovery: { required: false, steps: [] },
    diagnostics: [],
    guidance: opts.guidance,
  };
}

function withNextCommands(result: TaskForgeCommandResult, commands: ValidNextCommand[], taskId?: string): TaskForgeCommandResult {
  result.validNextCommands = commands;
  result.nextActions = commands.map((command) => actionFromNextCommand(command, taskId));
  return result;
}

function withNextActions(result: TaskForgeCommandResult, actions?: NextAction[]): TaskForgeCommandResult {
  if (actions) {
    result.nextActions = actions;
  }
  return result;
}

function withContextCleanup(result: TaskForgeCommandResult, required: boolean, reason?: string, actions: string[] = []): TaskForgeCommandResult {
  result.contextCleanup = { required, reason, actions };
  return result;
}

function withRecovery(result: TaskForgeCommandResult, required: boolean, steps: string[] = [], createTaskBody?: string): TaskForgeCommandResult {
  result.recovery = { required, steps, createTaskBody };
  if (result.nextActions.length === 0) {
    result.nextActions = steps.map(actionFromRecoveryStep);
  }
  return result;
}

function withDiagnostics(result: TaskForgeCommandResult, diagnostics: Array<{ level: "info" | "warn" | "error"; message: string }>): TaskForgeCommandResult {
  result.diagnostics = diagnostics;
  return result;
}

function withError(result: TaskForgeCommandResult, error: string, code?: string): TaskForgeCommandResult {
  result.error = error;
  result.code = code;
  result.commandError = {
    code: code ?? "FAILED",
    message: error,
    handled: result.nextActions.length > 0 || result.recovery.required,
  };
  return result;
}

/**
 * Build a success result.
 */
export function successResult(opts: BuilderOptions & { nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("success", true, opts);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  return result;
}

/**
 * Build a blocked result.
 */
export function blockedResult(opts: BuilderOptions & { reason: string; nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("blocked", false, opts);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  withError(result, opts.reason, "BLOCKED");
  return result;
}

/**
 * Build a failed result.
 */
export function failedResult(opts: BuilderOptions & { error: string; code?: string; recoverySteps?: string[]; nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("failed", false, opts);
  if (opts.recoverySteps && opts.recoverySteps.length > 0) {
    withRecovery(result, true, opts.recoverySteps);
  }
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  withError(result, opts.error, opts.code ?? "FAILED");
  return result;
}

/**
 * Build a noop result (no action taken).
 */
export function noopResult(opts: BuilderOptions & { reason?: string; nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("noop", true, opts);
  if (opts.reason) {
    withDiagnostics(result, [{ level: "info", message: opts.reason }]);
  }
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  return result;
}

/**
 * Build a human-required result.
 */
export function humanRequiredResult(opts: BuilderOptions & { reason: string; nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("human_required", false, opts);
  withRecovery(result, true, [
    "Block the task for human intervention: taskforge block <TASK-ID> \"reason\" --blocked-by human",
    "Or run taskforge doctor for system recovery",
  ]);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  withError(result, opts.reason, "HUMAN_REQUIRED");
  return result;
}

/**
 * Build a doctor-required result.
 */
export function doctorRequiredResult(opts: BuilderOptions & { reason: string; nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("doctor_required", false, opts);
  withRecovery(result, true, [
    "Run taskforge doctor to diagnose the issue",
    "If doctor cannot resolve, block for human: taskforge block <TASK-ID> \"reason\" --blocked-by human",
  ]);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  withError(result, opts.reason, "DOCTOR_REQUIRED");
  return result;
}

/**
 * Build a context cleanup result for task-switching commands.
 */
export function contextCleanupResult(opts: BuilderOptions & { reason: string; actions: string[]; nextCommands?: ValidNextCommand[]; nextActions?: NextAction[] }): TaskForgeCommandResult {
  const result = baseResult("success", true, opts);
  withContextCleanup(result, true, opts.reason, opts.actions);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands, opts.taskId);
  }
  withNextActions(result, opts.nextActions);
  return result;
}
