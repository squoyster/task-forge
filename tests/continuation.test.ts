import { describe, it, expect } from "vitest";
import { checkStoppingConditions, isSafeToContinue } from "../src/core/continuation.js";
import type { ParsedTask } from "../src/core/task-store.js";

function makeTask(overrides: Partial<ParsedTask>): ParsedTask {
  return {
    id: "TASK-001",
    type: "Task",
    status: "In Progress",
    priority: "P2",
    riskLevel: "Low",
    humanInterventionRequired: false,
    body: "# TASK-001: Test task",
    filePath: "/tmp/tasks/TASK-001.md",
    ...overrides,
  };
}

describe("Continuation", () => {
  it("allows continuation when no stopping conditions", () => {
    const task = makeTask({});
    expect(checkStoppingConditions(task)).toBeNull();
    expect(isSafeToContinue(task)).toBe(true);
  });

  it("stops when humanInterventionRequired is true", () => {
    const task = makeTask({ humanInterventionRequired: true });
    const condition = checkStoppingConditions(task);
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("human_intervention");
  });

  it("stops after repeated failures", () => {
    const task = makeTask({});
    const condition = checkStoppingConditions(task, { repeatedFailures: 3 });
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("repeated_failure");
  });

  it("allows continuation with 2 failures", () => {
    const task = makeTask({});
    expect(checkStoppingConditions(task, { repeatedFailures: 2 })).toBeNull();
  });

  it("stops on destructive operation", () => {
    const task = makeTask({});
    const condition = checkStoppingConditions(task, { isDestructive: true });
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("destructive_data_operation");
  });

  it("stops on production deploy", () => {
    const task = makeTask({});
    const condition = checkStoppingConditions(task, { isProductionDeploy: true });
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("production_deployment");
  });

  it("stops on credential access", () => {
    const task = makeTask({});
    const condition = checkStoppingConditions(task, { requiresCredentials: true });
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("credential_access");
  });

  it("stops on broad architecture change", () => {
    const task = makeTask({});
    const condition = checkStoppingConditions(task, { isBroadArchitectureChange: true });
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("broad_architecture_change");
  });

  it("stops on unrelated test failure", () => {
    const task = makeTask({});
    const condition = checkStoppingConditions(task, { hasUnrelatedFailure: true });
    expect(condition).not.toBeNull();
    expect(condition?.category).toBe("unrelated_test_failure");
  });
});
