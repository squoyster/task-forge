import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdStatus } from "../src/commands/status.js";
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

describe("cmdStatus --json", () => {
  it("outputs valid JSON with total, byStatus, and tasks keys", async () => {
    makeTaskFile("TASK-001", { status: "In Progress", priority: "P1" });
    makeTaskFile("TASK-002", { status: "Ready", priority: "P2" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdStatus(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("byStatus");
    expect(parsed).toHaveProperty("tasks");
    expect(parsed.total).toBe(2);
  });

  it("includes correct counts in byStatus", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    makeTaskFile("TASK-002", { status: "Ready" });
    makeTaskFile("TASK-003", { status: "Ready" });
    makeTaskFile("TASK-004", { status: "Done" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdStatus(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.byStatus).toEqual({
      "In Progress": 1,
      Ready: 2,
      Done: 1,
    });
  });

  it("includes id, title, priority, and status for each task", async () => {
    makeTaskFile("TASK-001", { status: "Ready", priority: "P1" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdStatus(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0]).toHaveProperty("id", "TASK-001");
    expect(parsed.tasks[0]).toHaveProperty("title");
    expect(parsed.tasks[0]).toHaveProperty("priority", "P1");
    expect(parsed.tasks[0]).toHaveProperty("status", "Ready");
  });

  it("handles empty task list", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdStatus(true);

    console.log = origLog;

    const parsed = JSON.parse(stdout.join("\n"));
    expect(parsed.total).toBe(0);
    expect(parsed.byStatus).toEqual({});
    expect(parsed.tasks).toEqual([]);
  });

  it("outputs only JSON with no extra decoration", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });

    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (...args: string[]) => stdout.push(args.join(" "));

    await cmdStatus(true);

    console.log = origLog;

    const output = stdout.join("\n").trim();
    // Should start with { and end with }
    expect(output.startsWith("{")).toBe(true);
    expect(output.endsWith("}")).toBe(true);
    // Should be parseable JSON
    expect(() => JSON.parse(output)).not.toThrow();
  });
});