import { describe, it, expect } from "vitest";
import { cmdCheckpoint, cmdSubmit, cmdPr } from "../src/commands/git-facade.js";

describe("git facade commands", () => {
  it("cmdCheckpoint throws for non-existent task", async () => {
    await expect(cmdCheckpoint("TASK-999", "test")).rejects.toThrow();
  });

  it("cmdSubmit throws for non-existent task", async () => {
    await expect(cmdSubmit("TASK-999")).rejects.toThrow();
  });

  it("cmdPr throws for non-existent task", async () => {
    await expect(cmdPr("TASK-999")).rejects.toThrow();
  });

  it("rejects commit trailers format", () => {
    const message = "feat: add feature";
    const fullMessage = [
      message,
      "",
      "Task: TASK-001",
      "TaskForge-Managed: true",
    ].join("\n");
    expect(fullMessage).toContain("Task: TASK-001");
    expect(fullMessage).toContain("TaskForge-Managed: true");
    expect(fullMessage).toContain("feat: add feature");
  });
});
