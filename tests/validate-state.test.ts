import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdValidateState } from "../src/commands/validate-state.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;
let repoDir: string;

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): string {
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...overrides,
  };
  const body = `# ${id}: Test task\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => {
      if (typeof v === "string" && /[\s:]/.test(v)) {
        return `${k}: "${v}"`;
      }
      return `${k}: ${v}`;
    }),
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-validate-test-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(uniqueDir, "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(repoDir, ".git", "config"), "[core]\n", "utf-8");
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdValidateState", () => {
  it("returns ok: true when state is valid", async () => {
    makeTaskFile("TASK-001");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdValidateState({ json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    logSpy.mockRestore();
  });

  it("returns ok: false when errors exist", async () => {
    // Create a Done task with assignee — this is an error
    makeTaskFile("TASK-001", { status: "Done", assignee: "test-session" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(cmdValidateState({ json: true })).rejects.toThrow();

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.status).toBe("failed");
    expect(output.code).toBe("VALIDATION_ERROR");
    logSpy.mockRestore();
  });

  it("returns ok: true with warnings when not in strict mode", async () => {
    // Create an In Progress task without assignee — this is a warning
    makeTaskFile("TASK-001", { status: "In Progress" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdValidateState({ json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    logSpy.mockRestore();
  });

  it("returns ok: false with warnings when in strict mode", async () => {
    // Create an In Progress task without assignee — this is a warning
    makeTaskFile("TASK-001", { status: "In Progress" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(cmdValidateState({ json: true, strict: true })).rejects.toThrow();

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.status).toBe("failed");
    expect(output.code).toBe("VALIDATION_ERROR");
    logSpy.mockRestore();
  });

  it("includes nextActions in error output", async () => {
    makeTaskFile("TASK-001", { status: "Done", assignee: "test-session" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(cmdValidateState({ json: true })).rejects.toThrow();

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.status).toBe("failed");
    expect(output.validNextCommands).toBeDefined();
    expect(output.validNextCommands.length).toBeGreaterThan(0);
    expect(output.validNextCommands[0].command).toContain("taskforge doctor");
    logSpy.mockRestore();
  });

  it("includes nextActions in success output", async () => {
    makeTaskFile("TASK-001");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdValidateState({ json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.validNextCommands).toBeDefined();
    expect(output.validNextCommands.length).toBeGreaterThan(0);
    logSpy.mockRestore();
  });

  it("exits non-zero in strict mode with warnings", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdValidateState({ json: true, strict: true });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("exits zero without strict mode when only warnings exist", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdValidateState({ json: true });

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
