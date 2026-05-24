export class TaskForgeError extends Error {
  public readonly code: string;
  public readonly exitCode: number;

  constructor(message: string, code = "TASKFORGE_ERROR", exitCode = 1) {
    super(message);
    this.name = "TaskForgeError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class TaskNotFoundError extends TaskForgeError {
  constructor(taskId: string) {
    super(`Task ${taskId} not found.`, "TASK_NOT_FOUND");
  }
}

export class InvalidStatusTransitionError extends TaskForgeError {
  constructor(from: string, to: string, allowed: string[]) {
    super(
      `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(", ")}`,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

export class WorktreeError extends TaskForgeError {
  constructor(message: string) {
    super(message, "WORKTREE_ERROR");
  }
}

export class ValidationError extends TaskForgeError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class MissingAcceptanceCriteriaError extends TaskForgeError {
  constructor(taskId: string) {
    super(
      `Task ${taskId} cannot be marked Done: no "## Acceptance Criteria" section found. ` +
        "Add acceptance criteria to the task file before completing, or request clarification if the ACs are ambiguous.",
      "MISSING_ACCEPTANCE_CRITERIA",
    );
  }
}

export class BlankAcceptanceCriteriaError extends TaskForgeError {
  constructor(taskId: string) {
    super(
      `Task ${taskId} cannot be marked Done: one or more acceptance criteria are blank. ` +
        "Replace placeholder checkboxes with verifiable conditions before completing.",
      "BLANK_ACCEPTANCE_CRITERIA",
    );
  }
}

export class UncheckedAcceptanceCriteriaError extends TaskForgeError {
  constructor(taskId: string) {
    super(
      `Task ${taskId} cannot be marked Done: one or more acceptance criteria remain unchecked. ` +
        "Check off each criterion with evidence before completing.",
      "UNCHECKED_ACCEPTANCE_CRITERIA",
    );
  }
}
