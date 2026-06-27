import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdPromote } from "../src/commands/promote.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-promote-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
  bodyFromParam?: string,
): string {
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "In Progress",
    priority: "P2",
    ...overrides,
  };
  const body = bodyFromParam ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

describe("cmdPromote", () => {
  it("promotes In Progress → Review by default", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Review");
  });

  it("promotes Review → Verify", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Review" });
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Verify");
  });

  it("promotes Verify → Done", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Verify" });
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Done");
  });

  it("promotes Inbox → Needs Spec", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Inbox" });
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Needs Spec");
  });

  it("promotes Needs Spec → Ready", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Needs Spec" });
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Ready");
  });

  it("promotes Ready → In Progress", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Ready" });
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: In Progress");
  });

  it("promotes Blocked → Ready (first allowed forward)", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Blocked" });
    await cmdPromote("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Ready");
  });

  it("promotes to a specific target with --to (Review → In Progress rollback)", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Review" });
    await cmdPromote("TASK-001", { to: "In Progress" });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: In Progress");
  });

  it("promotes to Verify with --to from Review", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Review" });
    await cmdPromote("TASK-001", { to: "Verify" });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Verify");
  });

  it("rejects --to with invalid status name", async () => {
    makeTaskFile("TASK-001");
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await cmdPromote("TASK-001", { to: "InvalidStatus" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown status"));
    logSpy.mockRestore();
  });

  it("rejects invalid transition (In Progress → Inbox)", async () => {
    makeTaskFile("TASK-001");
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await cmdPromote("TASK-001", { to: "Inbox" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot transition"));
    logSpy.mockRestore();
  });

  it("rejects promote from terminal status (Done)", async () => {
    makeTaskFile("TASK-001", { status: "Done" });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await cmdPromote("TASK-001");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No forward transition available"));
    logSpy.mockRestore();
  });

  it("rejects promote from Rejected", async () => {
    makeTaskFile("TASK-001", { status: "Rejected" });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await cmdPromote("TASK-001");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("terminal status"));
    logSpy.mockRestore();
  });

  it("outputs JSON with --json flag on success", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdPromote("TASK-001", { json: true });

    expect(logSpy).toHaveBeenCalled();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.metadata).toBeDefined();
    expect(parsed.context).toBeDefined();
    expect(parsed.context.taskId).toBe("TASK-001");
    expect(parsed.guidance).toContain("promoted");
    expect(parsed.guidance).toContain("In Progress");
    expect(parsed.guidance).toContain("Review");
    logSpy.mockRestore();
  });

  it("outputs JSON error for non-existent task", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdPromote("TASK-999", { json: true });

    expect(logSpy).toHaveBeenCalled();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("not found");
    expect(parsed.code).toBe("TASK_NOT_FOUND");
    logSpy.mockRestore();
  });

  it("outputs JSON error for invalid transition", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdPromote("TASK-001", { to: "Inbox", json: true });

    expect(logSpy).toHaveBeenCalled();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("INVALID_TRANSITION");
    expect(parsed.validNextCommands).toBeDefined();
    expect(parsed.validNextCommands.length).toBeGreaterThan(0);
    logSpy.mockRestore();
  });

  it("throws for non-existent task without --json", async () => {
    await expect(cmdPromote("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("handles --to with normalized variant (e.g. 'in_progress')", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Ready" });
    await cmdPromote("TASK-001", { to: "in_progress" });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: In Progress");
  });
});
