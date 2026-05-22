import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdStatus } from "../../src/commands/status.js";
import { setRepoRoot } from "../../src/util/paths.js";

let tmpDir: string;
let tasksDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-status-test-"));
  tasksDir = path.join(tmpDir, "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });
  setRepoRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): void {
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...overrides,
  };
  const body = `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(tasksDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

describe("cmdStatus", () => {
  it("shows message when no tasks exist", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No task files found"));
    logSpy.mockRestore();
  });

  it("shows status with tasks", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    makeTaskFile("TASK-002", { status: "Ready" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-001"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    logSpy.mockRestore();
  });

  it("outputs JSON with --json flag", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    makeTaskFile("TASK-002", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus(true);
    const jsonArg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonArg);
    expect(parsed.total).toBe(2);
    expect(parsed.byStatus.Ready).toBe(1);
    expect(parsed.byStatus.Done).toBe(1);
    expect(parsed.tasks).toHaveLength(2);
    logSpy.mockRestore();
  });

  it("handles tasks with humanInterventionRequired", async () => {
    makeTaskFile("TASK-001", {
      status: "Ready",
      humanInterventionRequired: true,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Human Action Needed"));
    logSpy.mockRestore();
  });

  it("outputs empty JSON when no tasks", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus(true);
    const jsonArg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonArg);
    expect(parsed.total).toBe(0);
    expect(parsed.tasks).toEqual([]);
    logSpy.mockRestore();
  });

  it("shows Review and Verify sections separately", async () => {
    makeTaskFile("TASK-001", { status: "Review" });
    makeTaskFile("TASK-002", { status: "Verify" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-001"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Review]"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Verify]"));
    logSpy.mockRestore();
  });

  it("shows Blocked section", async () => {
    makeTaskFile("TASK-001", { status: "Blocked" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Blocked"));
    logSpy.mockRestore();
  });

  it("shows Inbox and Needs Spec sections", async () => {
    makeTaskFile("TASK-001", { status: "Inbox" });
    makeTaskFile("TASK-002", { status: "Needs Spec" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Inbox"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Needs Spec"));
    logSpy.mockRestore();
  });

  it("shows Completed section with Done tasks", async () => {
    makeTaskFile("TASK-001", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdStatus();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Completed"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-001"));
    logSpy.mockRestore();
  });
});
