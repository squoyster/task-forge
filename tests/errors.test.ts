import { describe, it, expect } from "vitest";
import {
  TaskForgeError,
  TaskNotFoundError,
  InvalidStatusTransitionError,
  WorktreeError,
  ValidationError,
} from "../src/core/errors.js";

describe("TaskForgeError", () => {
  it("creates an error with default code and exitCode", () => {
    const err = new TaskForgeError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.code).toBe("TASKFORGE_ERROR");
    expect(err.exitCode).toBe(1);
    expect(err.name).toBe("TaskForgeError");
  });

  it("creates an error with custom code and exitCode", () => {
    const err = new TaskForgeError("Custom error", "CUSTOM_CODE", 42);
    expect(err.message).toBe("Custom error");
    expect(err.code).toBe("CUSTOM_CODE");
    expect(err.exitCode).toBe(42);
  });

  it("is instance of Error", () => {
    expect(new TaskForgeError("test")).toBeInstanceOf(Error);
  });
});

describe("TaskNotFoundError", () => {
  it("formats message with task ID", () => {
    const err = new TaskNotFoundError("TASK-123");
    expect(err.message).toBe("Task TASK-123 not found.");
    expect(err.code).toBe("TASK_NOT_FOUND");
    expect(err.exitCode).toBe(1);
  });

  it("is instance of TaskForgeError", () => {
    expect(new TaskNotFoundError("TASK-001")).toBeInstanceOf(TaskForgeError);
  });
});

describe("InvalidStatusTransitionError", () => {
  it("formats message with from, to, and allowed", () => {
    const err = new InvalidStatusTransitionError("Ready", "Done", ["In Progress"]);
    expect(err.message).toContain('"Ready"');
    expect(err.message).toContain('"Done"');
    expect(err.message).toContain("In Progress");
    expect(err.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("is instance of TaskForgeError", () => {
    expect(new InvalidStatusTransitionError("a", "b", ["c"])).toBeInstanceOf(TaskForgeError);
  });
});

describe("WorktreeError", () => {
  it("stores message and custom code", () => {
    const err = new WorktreeError("Could not create worktree");
    expect(err.message).toBe("Could not create worktree");
    expect(err.code).toBe("WORKTREE_ERROR");
    expect(err.exitCode).toBe(1);
  });

  it("is instance of TaskForgeError", () => {
    expect(new WorktreeError("test")).toBeInstanceOf(TaskForgeError);
  });
});

describe("ValidationError", () => {
  it("stores message and custom code", () => {
    const err = new ValidationError("Invalid input");
    expect(err.message).toBe("Invalid input");
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("is instance of TaskForgeError", () => {
    expect(new ValidationError("test")).toBeInstanceOf(TaskForgeError);
  });
});