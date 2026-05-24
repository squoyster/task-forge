import type { ParsedTask } from "./task-store.js";
import { STATUS } from "../util/status-constants.js";
import { hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "./task-store.js";

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
      errors.push({ severity: "error", code: "DONE_WITH_ASSIGNEE", taskId: t.id, message: "Done but still has assignee", suggestedFix: `taskforge done ${t.id} --force to clear` });
    }
    if (t.status === STATUS.DONE && t.claimed_at) {
      errors.push({ severity: "error", code: "DONE_WITH_CLAIM", taskId: t.id, message: "Done but still has claimed_at", suggestedFix: "Clear the claim field" });
    }

    // Done tasks must have valid acceptance criteria
    if (t.status === STATUS.DONE) {
      if (!hasAcceptanceCriteriaSection(t.body)) {
        errors.push({ severity: "error", code: "AC_MISSING", taskId: t.id, message: "Done task missing acceptance criteria section", suggestedFix: "Add acceptance criteria or request clarification" });
      } else if (hasBlankAcceptanceCriteria(t.body)) {
        errors.push({ severity: "error", code: "AC_BLANK", taskId: t.id, message: "Done task has blank acceptance criteria", suggestedFix: "Replace placeholder checkboxes with verifiable conditions" });
      } else if (hasUncheckedAcceptanceCriteria(t.body)) {
        errors.push({ severity: "error", code: "AC_UNCHECKED", taskId: t.id, message: "Done task has unchecked acceptance criteria", suggestedFix: "Check off each criterion with evidence" });
      }
    }

    // Ready must not have assignee
    if (t.status === STATUS.READY && t.assignee) {
      errors.push({ severity: "error", code: "READY_WITH_ASSIGNEE", taskId: t.id, message: "Ready but still has assignee", suggestedFix: "Clear the assignee/claimed_at fields" });
    }

    // Rejected/Deferred must not have assignee
    if ((t.status === STATUS.REJECTED || t.status === STATUS.DEFERRED) && t.assignee) {
      warnings.push({ severity: "warning", code: "TERMINAL_WITH_ASSIGNEE", taskId: t.id, message: `${t.status} but still has assignee`, suggestedFix: "Clear the claim fields" });
    }

    // In Progress should have assignee
    if (t.status === STATUS.IN_PROGRESS && !t.assignee) {
      warnings.push({ severity: "warning", code: "IN_PROGRESS_NO_ASSIGNEE", taskId: t.id, message: "In Progress but no assignee", suggestedFix: "Claim the task or reset to Ready" });
    }
    if (t.status === STATUS.IN_PROGRESS && !t.claimed_at) {
      warnings.push({ severity: "warning", code: "IN_PROGRESS_NO_CLAIMED_AT", taskId: t.id, message: "In Progress but no claimed_at" });
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

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
