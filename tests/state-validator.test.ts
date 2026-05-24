import { describe, it, expect } from "vitest";
import { validateTaskState } from "../src/core/state-validator.js";
import type { ParsedTask } from "../src/core/task-store.js";
import { STATUS } from "../src/util/status-constants.js";

function makeTask(overrides: Partial<ParsedTask> = {}): ParsedTask {
  return {
    id: "TASK-001",
    type: "Task",
    status: STATUS.READY,
    priority: "P2",
    riskLevel: "Low",
    humanInterventionRequired: false,
    body: "# TASK-001: Test\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [x] Done\n\n## Agent Notes\n",
    filePath: "/tmp/TASK-001.md",
    ...overrides,
  } as ParsedTask;
}

describe("validateTaskState AC checks", () => {
  it("errors when Done task is missing AC section", () => {
    const task = makeTask({
      status: STATUS.DONE,
      body: "# TASK-001: Test\n\n## Goal\nDo something.\n\n## Agent Notes\n",
    });
    const result = validateTaskState([task]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "AC_MISSING")).toBe(true);
  });

  it("errors when Done task has blank AC", () => {
    const task = makeTask({
      status: STATUS.DONE,
      body: "# TASK-001: Test\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ]\n\n## Agent Notes\n",
    });
    const result = validateTaskState([task]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "AC_BLANK")).toBe(true);
  });

  it("errors when Done task has unchecked AC", () => {
    const task = makeTask({
      status: STATUS.DONE,
      body: "# TASK-001: Test\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ] Do something\n\n## Agent Notes\n",
    });
    const result = validateTaskState([task]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "AC_UNCHECKED")).toBe(true);
  });

  it("passes when Done task has all AC checked", () => {
    const task = makeTask({
      status: STATUS.DONE,
      body: "# TASK-001: Test\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [x] Do something\n\n## Agent Notes\n",
    });
    const result = validateTaskState([task]);
    expect(result.ok).toBe(true);
    expect(result.errors.some((e) => e.code.startsWith("AC_"))).toBe(false);
  });

  it("ignores AC checks for non-Done tasks", () => {
    const task = makeTask({
      status: STATUS.READY,
      body: "# TASK-001: Test\n\n## Goal\nDo something.\n\n## Agent Notes\n",
    });
    const result = validateTaskState([task]);
    expect(result.ok).toBe(true);
    expect(result.errors.some((e) => e.code.startsWith("AC_"))).toBe(false);
  });
});
