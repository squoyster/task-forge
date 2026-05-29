import type {
  TaskForgeCommandResult,
  ValidNextCommand,
  CommandStatus,
} from "./command-result.js";
import { STANDARD_PROHIBITED_ACTIONS } from "./command-result.js";
import { resolveAuthority } from "./authority.js";

interface BuilderOptions {
  command: string;
  taskId?: string;
  worktree?: string;
  branch?: string;
  sessionId?: string;
  guidance?: string;
  duration?: number;
}

function baseResult(status: CommandStatus, ok: boolean, opts: BuilderOptions): TaskForgeCommandResult {
  const authority = resolveAuthority();
  const isNormalAgent = authority === "agent" || !authority;

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
    validNextCommands: [],
    todoMerge: { required: false, items: [] },
    contextCleanup: { required: false, actions: [] },
    prohibitedActions: isNormalAgent ? [...STANDARD_PROHIBITED_ACTIONS] : [],
    recovery: { required: false, steps: [] },
    diagnostics: [],
    guidance: opts.guidance,
  };
}

function withNextCommands(result: TaskForgeCommandResult, commands: ValidNextCommand[]): TaskForgeCommandResult {
  result.validNextCommands = commands;
  return result;
}

function withContextCleanup(result: TaskForgeCommandResult, required: boolean, reason?: string, actions: string[] = []): TaskForgeCommandResult {
  result.contextCleanup = { required, reason, actions };
  return result;
}

function withRecovery(result: TaskForgeCommandResult, required: boolean, steps: string[] = [], createTaskBody?: string): TaskForgeCommandResult {
  result.recovery = { required, steps, createTaskBody };
  return result;
}

function withDiagnostics(result: TaskForgeCommandResult, diagnostics: Array<{ level: "info" | "warn" | "error"; message: string }>): TaskForgeCommandResult {
  result.diagnostics = diagnostics;
  return result;
}

function withError(result: TaskForgeCommandResult, error: string, code?: string): TaskForgeCommandResult {
  result.error = error;
  result.code = code;
  return result;
}

/**
 * Build a success result.
 */
export function successResult(opts: BuilderOptions & { nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("success", true, opts);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}

/**
 * Build a blocked result.
 */
export function blockedResult(opts: BuilderOptions & { reason: string; nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("blocked", false, opts);
  withError(result, opts.reason, "BLOCKED");
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}

/**
 * Build a failed result.
 */
export function failedResult(opts: BuilderOptions & { error: string; code?: string; recoverySteps?: string[]; nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("failed", false, opts);
  withError(result, opts.error, opts.code ?? "FAILED");
  if (opts.recoverySteps && opts.recoverySteps.length > 0) {
    withRecovery(result, true, opts.recoverySteps);
  }
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}

/**
 * Build a noop result (no action taken).
 */
export function noopResult(opts: BuilderOptions & { reason?: string; nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("noop", true, opts);
  if (opts.reason) {
    withDiagnostics(result, [{ level: "info", message: opts.reason }]);
  }
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}

/**
 * Build a human-required result.
 */
export function humanRequiredResult(opts: BuilderOptions & { reason: string; nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("human_required", false, opts);
  withError(result, opts.reason, "HUMAN_REQUIRED");
  withRecovery(result, true, [
    "Block the task for human intervention: taskforge block <TASK-ID> \"reason\" --blocked-by human",
    "Or run taskforge doctor for system recovery",
  ]);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}

/**
 * Build a doctor-required result.
 */
export function doctorRequiredResult(opts: BuilderOptions & { reason: string; nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("doctor_required", false, opts);
  withError(result, opts.reason, "DOCTOR_REQUIRED");
  withRecovery(result, true, [
    "Run taskforge doctor to diagnose the issue",
    "If doctor cannot resolve, block for human: taskforge block <TASK-ID> \"reason\" --blocked-by human",
  ]);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}

/**
 * Build a context cleanup result for task-switching commands.
 */
export function contextCleanupResult(opts: BuilderOptions & { reason: string; actions: string[]; nextCommands?: ValidNextCommand[] }): TaskForgeCommandResult {
  const result = baseResult("success", true, opts);
  withContextCleanup(result, true, opts.reason, opts.actions);
  if (opts.nextCommands) {
    withNextCommands(result, opts.nextCommands);
  }
  return result;
}
