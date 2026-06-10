import type { ParsedTask } from "./task-store.js";
import { findDuplicateStructuralSections } from "./task-store.js";
import { STATUS } from "../util/status-constants.js";
import { TaskForgeCommandResultSchema, STANDARD_PROHIBITED_ACTIONS } from "./command-result.js";
import { NEXT_COMMAND_MAPS } from "./next-command-maps.js";

export type ValidationSeverity = "error" | "warning";

export interface StateValidationIssue {
  severity: ValidationSeverity;
  code: string;
  taskId?: string;
  message: string;
  suggestedFix?: string;
}

export interface StateValidationResult {
  ok: boolean;
  errors: StateValidationIssue[];
  warnings: StateValidationIssue[];
}

export function validateTaskState(tasks: ParsedTask[]): StateValidationResult {
  const errors: StateValidationIssue[] = [];
  const warnings: StateValidationIssue[] = [];
  const ids = new Set<string>();

  for (const t of tasks) {
    // Duplicate ID
    if (ids.has(t.id)) {
      errors.push({ severity: "error", code: "DUPLICATE_ID", taskId: t.id, message: `Duplicate task ID`, suggestedFix: "Remove or rename the duplicate" });
    }
    ids.add(t.id);

    // Done must not have assignee
    if (t.status === STATUS.DONE && t.assignee) {
      errors.push({ severity: "error", code: "DONE_WITH_ASSIGNEE", taskId: t.id, message: "Done but still has assignee", suggestedFix: `Clear the assignee/claimed_at fields from ${t.id}` });
    }
    if (t.status === STATUS.DONE && t.claimed_at) {
      errors.push({ severity: "error", code: "DONE_WITH_CLAIM", taskId: t.id, message: "Done but still has claimed_at", suggestedFix: "Clear the claim field" });
    }

    // Ready must not have assignee
    if (t.status === STATUS.READY && t.assignee) {
      errors.push({ severity: "error", code: "READY_WITH_ASSIGNEE", taskId: t.id, message: "Ready but still has assignee", suggestedFix: "Clear the assignee/claimed_at fields" });
    }

    // Rejected/Deferred must not have assignee
    if ((t.status === STATUS.REJECTED || t.status === STATUS.DEFERRED) && t.assignee) {
      warnings.push({ severity: "warning", code: "TERMINAL_WITH_ASSIGNEE", taskId: t.id, message: `${t.status} but still has assignee`, suggestedFix: "Clear the claim fields" });
    }

    // Active states should have assignee
    const activeNeedsAssignee = [STATUS.IN_PROGRESS, STATUS.IMPLEMENTATION_COMPLETE, STATUS.SUBMITTED, STATUS.REVIEW, STATUS.MERGE_READY, STATUS.VERIFY];
    if (activeNeedsAssignee.includes(t.status as any) && !t.assignee) {
      warnings.push({ severity: "warning", code: "ACTIVE_NO_ASSIGNEE", taskId: t.id, message: `${t.status} but no assignee`, suggestedFix: "Claim the task or reset to Ready" });
    }
    if (activeNeedsAssignee.includes(t.status as any) && !t.claimed_at) {
      warnings.push({ severity: "warning", code: "ACTIVE_NO_CLAIMED_AT", taskId: t.id, message: `${t.status} but no claimed_at` });
    }

    // Blocked must have blocked_reason
    if (t.status === STATUS.BLOCKED && !t.blocked_reason) {
      errors.push({ severity: "error", code: "BLOCKED_NO_REASON", taskId: t.id, message: "Blocked but no blocked_reason" });
    }
    if (t.status === STATUS.BLOCKED && !t.blocked_since) {
      warnings.push({ severity: "warning", code: "BLOCKED_NO_SINCE", taskId: t.id, message: "Blocked but no blocked_since" });
    }

    // Self-dependency
    if (t.dependsOn?.includes(t.id)) {
      errors.push({ severity: "error", code: "SELF_DEPENDENCY", taskId: t.id, message: "Task depends on itself" });
    }

    const duplicateSections = findDuplicateStructuralSections(t.body);
    if (duplicateSections.length > 0) {
      warnings.push({
        severity: "warning",
        code: "DUPLICATE_TASK_SECTIONS",
        taskId: t.id,
        message: `Duplicate structural sections: ${duplicateSections.join(", ")}`,
        suggestedFix: "Normalize the task markdown so each structural section appears at most once",
      });
    }

    // Branch pattern
    if (t.branch && !/^agent\//.test(t.branch)) {
      warnings.push({ severity: "warning", code: "BRANCH_PATTERN", taskId: t.id, message: `Branch "${t.branch}" does not match expected agent/ pattern` });
    }
  }

  // Broken dependsOn references
  const allIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (t.dependsOn) {
      for (const dep of t.dependsOn) {
        if (!allIds.has(dep)) {
          errors.push({ severity: "error", code: "BROKEN_DEPENDENCY", taskId: t.id, message: `dependsOn references non-existent task: ${dep}` });
        }
      }
    }
  }

  // Circular dependencies
  for (const t of tasks) {
    if (t.dependsOn) {
      for (const dep of t.dependsOn) {
        const depTask = tasks.find((d) => d.id === dep);
        if (depTask?.dependsOn?.includes(t.id)) {
          errors.push({ severity: "error", code: "CIRCULAR_DEPENDENCY", taskId: t.id, message: `Circular dependency with ${dep}` });
        }
      }
    }
  }

  // Command return schema validation
  const schemaResult = validateCommandReturnSchema();
  errors.push(...schemaResult.errors);
  warnings.push(...schemaResult.warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateCommandReturnSchema(): { errors: StateValidationIssue[]; warnings: StateValidationIssue[] } {
  const errors: StateValidationIssue[] = [];
  const warnings: StateValidationIssue[] = [];

  // Check that standard prohibited actions exist
  if (STANDARD_PROHIBITED_ACTIONS.length !== 5) {
    errors.push({
      severity: "error",
      code: "INVALID_PROHIBITED_ACTIONS",
      message: `Expected 5 standard prohibited actions, found ${STANDARD_PROHIBITED_ACTIONS.length}`,
      suggestedFix: "Ensure STANDARD_PROHIBITED_ACTIONS has exactly 5 entries",
    });
  }

  // Check that prohibited actions don't include --force for normal agents
  const forceActions = STANDARD_PROHIBITED_ACTIONS.filter((a) => a.action.includes("--force"));
  if (forceActions.length > 0) {
    errors.push({
      severity: "error",
      code: "FORCE_IN_PROHIBITED",
      message: "Standard prohibited actions should not include --force references",
      suggestedFix: "Remove --force from standard prohibited actions",
    });
  }

  // Check that next command maps exist for major commands
  const majorCommands = ["init", "next", "start", "done", "claim", "release", "heartbeat", "checkpoint", "submit", "pr"];
  for (const cmd of majorCommands) {
    if (!NEXT_COMMAND_MAPS[cmd]) {
      errors.push({
        severity: "error",
        code: "MISSING_NEXT_COMMAND_MAP",
        message: `No validNextCommands map defined for command: ${cmd}`,
        suggestedFix: `Add next command map for ${cmd} in next-command-maps.ts`,
      });
    }
  }

  // Check that no normal-agent next commands include --force
  for (const [cmd, outcomes] of Object.entries(NEXT_COMMAND_MAPS)) {
    for (const [outcome, commands] of Object.entries(outcomes)) {
      for (const nextCmd of commands) {
        if (nextCmd.command.includes("--force") && nextCmd.allowedFor !== "human" && nextCmd.allowedFor !== "doctor") {
          errors.push({
            severity: "error",
            code: "FORCE_IN_NEXT_COMMANDS",
            message: `Command ${cmd} (${outcome}) includes --force in validNextCommands for normal agents: ${nextCmd.command}`,
            suggestedFix: "Remove --force from next commands or set allowedFor to human/doctor",
          });
        }
      }
    }
  }

  // Validate a sample result against the schema
  const sampleResult = {
    ok: true,
    status: "success",
    metadata: { command: "test", timestamp: new Date().toISOString() },
    context: {},
    agentPrompt: { role: "implementer" },
    validNextCommands: [],
    todoMerge: { required: false, items: [] },
    contextCleanup: { required: false, actions: [] },
    prohibitedActions: STANDARD_PROHIBITED_ACTIONS,
    recovery: { required: false, steps: [] },
    diagnostics: [],
  };

  const parsed = TaskForgeCommandResultSchema.safeParse(sampleResult);
  if (!parsed.success) {
    errors.push({
      severity: "error",
      code: "INVALID_COMMAND_RESULT_SCHEMA",
      message: "TaskForgeCommandResult schema validation failed for sample result",
      suggestedFix: "Fix the schema definition in command-result.ts",
    });
  }

  return { errors, warnings };
}
