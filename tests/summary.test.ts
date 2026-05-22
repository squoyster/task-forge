import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdSummary } from "../src/commands/summary.js";
import { setRepoRoot } from "../src/util/paths.js";

let tmpDir: string;
let tasksDir: string;
let originalArgv: string[];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-test-"));
  tasksDir = path.join(tmpDir, "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });
  setRepoRoot(tmpDir);

  originalArgv = process.argv;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
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
  fs.writeFileSync(path.join(tasksDir, `${id}.md`), lines.join("\n"), "utf-8");
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
    expect(parsed).toHaveProperty("generated");
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("byStatus");
    expect(parsed).toHaveProperty("nextAction");
    expect(parsed).toHaveProperty("tasks");
    expect(parsed.total).toBe(2);
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
    expect(parsed.byStatus).toEqual({
      "In Progress": 1,
      Ready: 1,
      Done: 1,
    });
  });

  it("includes id, title, priority, role, status for each task", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P1" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0]).toHaveProperty("id", "TASK-001");
    expect(parsed.tasks[0]).toHaveProperty("title");
    expect(parsed.tasks[0]).toHaveProperty("priority", "P1");
    expect(parsed.tasks[0]).toHaveProperty("role", "Implementer");
    expect(parsed.tasks[0]).toHaveProperty("status", "Ready");
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
    expect(parsed.nextAction).toBe("Continue existing in-progress work.");
  });

  it("suggests correct next action with no active tasks", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P1" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.nextAction).toContain("TASK-001");
  });

  it("handles empty task list", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdSummary(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.total).toBe(0);
    expect(parsed.byStatus).toEqual({});
    expect(parsed.tasks).toEqual([]);
    expect(parsed.nextAction).toBe("No actionable tasks. Add work to the inbox.");
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