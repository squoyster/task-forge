import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdNext } from "../../src/commands/next.js";
import { setRepoRoot } from "../../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-next-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): void {
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...overrides,
  };
  const body = `# ${id}: Test task ${id}\n\n## Goal\nDo something important.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

describe("cmdNext", () => {
  it("shows message when no tasks exist", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No task files found"));
    logSpy.mockRestore();
  });

  it("shows message when no actionable tasks exist", async () => {
    makeTaskFile("TASK-001", { status: "Inbox" });
    makeTaskFile("TASK-002", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No actionable tasks found"));
    logSpy.mockRestore();
  });

  it("selects In Progress task over Ready task", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P0" });
    makeTaskFile("TASK-002", { status: "In Progress", priority: "P2" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("In Progress"));
    logSpy.mockRestore();
  });

  it("selects highest priority Ready task when no In Progress", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P2" });
    makeTaskFile("TASK-002", { status: "Ready", priority: "P0" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    logSpy.mockRestore();
  });

  it("shows score in output", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Score:"));
    logSpy.mockRestore();
  });

  it("shows goal in output", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Goal:"));
    logSpy.mockRestore();
  });

  it("shows file path in output", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("File:"));
    logSpy.mockRestore();
  });

  it("handles non-actionable tasks besides Inbox and Done", async () => {
    makeTaskFile("TASK-001", { status: "Blocked" });
    makeTaskFile("TASK-002", { status: "Needs Spec" });
    makeTaskFile("TASK-003", { status: "Rejected" });
    makeTaskFile("TASK-004", { status: "Deferred" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No actionable tasks found"));
    logSpy.mockRestore();
  });

  it("selects Verify over Ready", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    makeTaskFile("TASK-002", { status: "Verify" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    logSpy.mockRestore();
  });

  it("selects Review over Ready", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    makeTaskFile("TASK-002", { status: "Review" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdNext();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    logSpy.mockRestore();
  });
});
