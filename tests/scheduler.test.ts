import { describe, it, expect } from "vitest";
import { selectNextTask, scoreTask, getTasksByStatus } from "../src/core/scheduler.js";
import type { ParsedTask } from "../src/core/task-store.js";

function makeTask(overrides: Partial<ParsedTask>): ParsedTask {
  return {
    id: "TASK-001",
    type: "Task",
    status: "Ready",
    priority: "P2",
    riskLevel: "Low",
    humanInterventionRequired: false,
    body: "# TASK-001: Test task",
    filePath: "/tmp/tasks/TASK-001.md",
    ...overrides,
  };
}

describe("Scheduler", () => {
  it("scores In Progress higher than Ready", () => {
    const inProgress = makeTask({ id: "TASK-001", status: "In Progress", priority: "P2" });
    const ready = makeTask({ id: "TASK-002", status: "Ready", priority: "P2" });
    expect(scoreTask(inProgress)).toBeGreaterThan(scoreTask(ready));
  });

  it("scores P0 higher than P1 at same status", () => {
    const p0 = makeTask({ id: "TASK-001", status: "Ready", priority: "P0" });
    const p1 = makeTask({ id: "TASK-002", status: "Ready", priority: "P1" });
    expect(scoreTask(p0)).toBeGreaterThan(scoreTask(p1));
  });

  it("selects In Progress task over Ready task", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Ready", priority: "P0" }),
      makeTask({ id: "TASK-002", status: "In Progress", priority: "P2" }),
    ];
    const next = selectNextTask(tasks);
    expect(next?.id).toBe("TASK-002");
  });

  it("selects Verify over Ready", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Ready", priority: "P0" }),
      makeTask({ id: "TASK-002", status: "Verify", priority: "P2" }),
    ];
    const next = selectNextTask(tasks);
    expect(next?.id).toBe("TASK-002");
  });

  it("selects Review over Ready", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Ready", priority: "P0" }),
      makeTask({ id: "TASK-002", status: "Review", priority: "P2" }),
    ];
    const next = selectNextTask(tasks);
    expect(next?.id).toBe("TASK-002");
  });

  it("returns null for empty array", () => {
    expect(selectNextTask([])).toBeNull();
  });

  it("returns null when only non-actionable tasks exist", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Inbox" }),
      makeTask({ id: "TASK-002", status: "Done" }),
      makeTask({ id: "TASK-003", status: "Blocked" }),
    ];
    expect(selectNextTask(tasks)).toBeNull();
  });

  it("groups tasks by status", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Ready" }),
      makeTask({ id: "TASK-002", status: "Ready" }),
      makeTask({ id: "TASK-003", status: "In Progress" }),
    ];
    const grouped = getTasksByStatus(tasks);
    expect(grouped["Ready"]).toHaveLength(2);
    expect(grouped["In Progress"]).toHaveLength(1);
  });
});
