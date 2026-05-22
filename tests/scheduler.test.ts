import { describe, it, expect } from "vitest";
import {
  selectNextTask,
  scoreTask,
  getTasksByStatus,
  hasUnmetDependencies,
  getDependents,
  detectCircularDependencies,
} from "../src/core/scheduler.js";
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

describe("scoreTask", () => {
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
});

describe("selectNextTask", () => {
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

  it("excludes tasks with unmet dependencies", () => {
    const tasks = [
      makeTask({
        id: "TASK-002",
        status: "Ready",
        priority: "P1",
        dependsOn: ["TASK-001"],
      }),
      makeTask({
        id: "TASK-001",
        status: "In Progress",
        priority: "P2",
      }),
    ];
    // TASK-002 depends on TASK-001 which is In Progress, not Done
    const next = selectNextTask(tasks);
    // TASK-002 should be excluded; only actionable is TASK-001
    expect(next?.id).toBe("TASK-001");
  });

  it("allows task when all dependencies are Done", () => {
    const tasks = [
      makeTask({
        id: "TASK-003",
        status: "Ready",
        priority: "P1",
        dependsOn: ["TASK-001", "TASK-002"],
      }),
      makeTask({ id: "TASK-001", status: "Done" }),
      makeTask({ id: "TASK-002", status: "Done" }),
    ];
    const next = selectNextTask(tasks);
    expect(next?.id).toBe("TASK-003");
  });

  it("considers missing dependency task as unmet", () => {
    const tasks = [
      makeTask({
        id: "TASK-002",
        status: "Ready",
        priority: "P1",
        dependsOn: ["TASK-999"],
      }),
    ];
    const next = selectNextTask(tasks);
    expect(next).toBeNull();
  });
});

describe("hasUnmetDependencies", () => {
  it("returns empty for task without dependsOn", () => {
    const task = makeTask({});
    expect(hasUnmetDependencies(task, [task])).toEqual([]);
  });

  it("returns empty for task with empty dependsOn", () => {
    const task = makeTask({ dependsOn: [] });
    expect(hasUnmetDependencies(task, [task])).toEqual([]);
  });

  it("returns unmet when dependency is not Done", () => {
    const tasks = [
      makeTask({ id: "TASK-002", dependsOn: ["TASK-001"] }),
      makeTask({ id: "TASK-001", status: "In Progress" }),
    ];
    expect(hasUnmetDependencies(tasks[0], tasks)).toEqual(["TASK-001"]);
  });

  it("returns empty when dependency is Done", () => {
    const tasks = [
      makeTask({ id: "TASK-002", dependsOn: ["TASK-001"] }),
      makeTask({ id: "TASK-001", status: "Done" }),
    ];
    expect(hasUnmetDependencies(tasks[0], tasks)).toEqual([]);
  });

  it("treats missing dependency task as unmet", () => {
    const task = makeTask({ dependsOn: ["TASK-999"] });
    expect(hasUnmetDependencies(task, [task])).toEqual(["TASK-999"]);
  });
});

describe("getDependents", () => {
  it("returns tasks that depend on the given task", () => {
    const tasks = [
      makeTask({ id: "TASK-001" }),
      makeTask({ id: "TASK-002", dependsOn: ["TASK-001"] }),
      makeTask({ id: "TASK-003", dependsOn: ["TASK-001"] }),
    ];
    const dependents = getDependents("TASK-001", tasks);
    expect(dependents.map((d) => d.id).sort()).toEqual(["TASK-002", "TASK-003"]);
  });

  it("returns empty when no tasks depend on the given task", () => {
    const tasks = [
      makeTask({ id: "TASK-001" }),
      makeTask({ id: "TASK-002" }),
    ];
    expect(getDependents("TASK-001", tasks)).toEqual([]);
  });
});

describe("detectCircularDependencies", () => {
  it("returns empty for tasks with no dependencies", () => {
    const tasks = [
      makeTask({ id: "TASK-001" }),
      makeTask({ id: "TASK-002" }),
    ];
    expect(detectCircularDependencies(tasks)).toEqual([]);
  });

  it("detects direct cycle", () => {
    const tasks = [
      makeTask({ id: "TASK-001", dependsOn: ["TASK-002"] }),
      makeTask({ id: "TASK-002", dependsOn: ["TASK-001"] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain("Circular dependency");
    expect(cycles[0]).toContain("TASK-001");
    expect(cycles[0]).toContain("TASK-002");
  });

  it("detects indirect cycle", () => {
    const tasks = [
      makeTask({ id: "TASK-001", dependsOn: ["TASK-002"] }),
      makeTask({ id: "TASK-002", dependsOn: ["TASK-003"] }),
      makeTask({ id: "TASK-003", dependsOn: ["TASK-001"] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain("Circular dependency");
  });

  it("returns empty for acyclic graph", () => {
    const tasks = [
      makeTask({ id: "TASK-001" }),
      makeTask({ id: "TASK-002", dependsOn: ["TASK-001"] }),
      makeTask({ id: "TASK-003", dependsOn: ["TASK-002"] }),
    ];
    expect(detectCircularDependencies(tasks)).toEqual([]);
  });

  it("does not crash with self-referencing dependency", () => {
    const tasks = [
      makeTask({ id: "TASK-001", dependsOn: ["TASK-001"] }),
    ];
    const cycles = detectCircularDependencies(tasks);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe("getTasksByStatus", () => {
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
