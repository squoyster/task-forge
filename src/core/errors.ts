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
