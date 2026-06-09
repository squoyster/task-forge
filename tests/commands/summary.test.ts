import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdSummary } from "../../src/commands/summary.js";
import { setRepoRoot } from "../../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-summary-test-"));
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
  const body = `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
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

describe("cmdSummary", () => {
  it("shows message when no tasks exist", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No task files found"));
    logSpy.mockRestore();
  });

  it("shows summary with various statuses", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    makeTaskFile("TASK-002", { status: "Blocked" });
    makeTaskFile("TASK-003", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Active"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Blocked"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Completed"));
    logSpy.mockRestore();
  });

  it("outputs JSON with --json flag", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    makeTaskFile("TASK-002", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary(true);
    const jsonArg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonArg);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.guidance).toContain("2 total tasks");
    logSpy.mockRestore();
  });

  it("recommends continue in-progress when active tasks exist", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Continue existing in-progress work"));
    logSpy.mockRestore();
  });

  it("recommends start next task when nothing in progress", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Start the highest-priority task"));
    logSpy.mockRestore();
  });

  it("shows JSON with empty task list", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary(true);
    const jsonArg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonArg);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.guidance).toContain("0 total tasks");
    logSpy.mockRestore();
  });

  it("includes review and verify sections", async () => {
    makeTaskFile("TASK-001", { status: "Review" });
    makeTaskFile("TASK-002", { status: "Verify" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Review]"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Verify]"));
    logSpy.mockRestore();
  });

  it("includes human intervention section", async () => {
    makeTaskFile("TASK-001", { status: "Ready", humanInterventionRequired: true });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Human Action Needed"));
    logSpy.mockRestore();
  });

  it("recommends QA when tasks are in Verify", async () => {
    makeTaskFile("TASK-001", { status: "Verify" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("QA/verification"));
    logSpy.mockRestore();
  });

  it("recommends review when tasks are in Review", async () => {
    makeTaskFile("TASK-001", { status: "Review" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSummary();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Review tasks"));
    logSpy.mockRestore();
  });
});
