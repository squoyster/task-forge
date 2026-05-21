import { describe, it, expect } from "vitest";
import { TaskSchema, TaskStatus, TaskPriority, TaskType, RiskLevel } from "../src/core/task.js";

describe("TaskSchema", () => {
  it("parses a valid task", () => {
    const result = TaskSchema.safeParse({
      id: "TASK-001",
      type: "Task",
      status: "Ready",
      priority: "P1",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for missing fields", () => {
    const result = TaskSchema.safeParse({ id: "TASK-001" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("Task");
      expect(result.data.status).toBe("Inbox");
      expect(result.data.priority).toBe("P2");
      expect(result.data.riskLevel).toBe("Low");
      expect(result.data.humanInterventionRequired).toBe(false);
    }
  });

  it("rejects invalid status", () => {
    const result = TaskSchema.safeParse({
      id: "TASK-001",
      status: "Invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = TaskSchema.safeParse({
      id: "TASK-001",
      priority: "P5",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid task types", () => {
    const types = TaskType.options;
    for (const type of types) {
      const result = TaskSchema.safeParse({ id: "TASK-001", type });
      expect(result.success).toBe(true);
    }
  });

  it("accepts Dependency, Security, Maintenance types", () => {
    for (const type of ["Dependency", "Security", "Maintenance"]) {
      const result = TaskSchema.safeParse({ id: "DEP-001", type });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid risk levels", () => {
    for (const level of RiskLevel.options) {
      const result = TaskSchema.safeParse({ id: "TASK-001", riskLevel: level });
      expect(result.success).toBe(true);
    }
  });

  it("parses optional fields", () => {
    const result = TaskSchema.safeParse({
      id: "TASK-001",
      agentRole: "Implementer",
      branch: "agent/TASK-001-test",
      worktree: "../worktrees/TASK-001",
      issue: 42,
      pr: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agentRole).toBe("Implementer");
      expect(result.data.branch).toBe("agent/TASK-001-test");
      expect(result.data.issue).toBe(42);
      expect(result.data.pr).toBe(100);
    }
  });
});
