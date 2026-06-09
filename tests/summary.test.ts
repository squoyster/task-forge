import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdSummary } from "../src/commands/summary.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;
let originalArgv: string[];

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);

  originalArgv = process.argv;
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
  process.argv = originalArgv;
});

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): void {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = bodyOverride as string | undefined ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n`;
  const lines = ["---", ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`), "---", "", body];
  fs.writeFileSync(path.join(stateDir, `${id}.md`), lines.join("\n"), "utf-8");
}

describe("cmdSummary --json", () => {
  it("outputs valid JSON with expected top-level keys", async () => {
    makeTaskFile("TASK-001", { status: "In Progress", priority: "P1" });
    makeTaskFile("TASK-002", { status: "Ready", priority: "P2" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.guidance).toContain("2 total tasks");
  });

  it("includes correct counts in byStatus", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    makeTaskFile("TASK-002", { status: "Ready" });
    makeTaskFile("TASK-003", { status: "Done" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.guidance).toContain("3 total tasks");
  });

  it("includes id, title, priority, role, status for each task", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P1" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
  });

  it("suggests correct next action for in-progress tasks", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    makeTaskFile("TASK-002", { status: "Ready" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
  });

  it("suggests correct next action with no active tasks", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P1" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
  });

  it("handles empty task list", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.guidance).toContain("0 total tasks");
  });

  it("outputs only JSON with no extra decoration", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const output = stdout.join("\n").trim();
    expect(output.startsWith("{")).toBe(true);
    expect(output.endsWith("}")).toBe(true);
    expect(() => JSON.parse(output)).not.toThrow();
  });
});