import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdAcCheck } from "../src/commands/ac-check.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-ac-check-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(id: string, body: string): void {
  const lines = [
    "---",
    `id: ${id}`,
    "type: Task",
    "status: Ready",
    "priority: P2",
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

describe("cmdAcCheck", () => {
  it("reports no issues for a well-formed task", () => {
    makeTaskFile("TASK-001", `# TASK-001: Test\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [x] Do something\n`);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdAcCheck("TASK-001", { json: true });
    spy.mockRestore();
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("All acceptance criteria look good");
  });

  it("reports missing AC section", () => {
    makeTaskFile("TASK-001", `# TASK-001: Test\n\n## Goal\nDo something.\n`);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdAcCheck("TASK-001", { json: true });
    spy.mockRestore();
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("Found 1");
  });

  it("reports blank AC items", () => {
    makeTaskFile("TASK-001", `# TASK-001: Test\n\n## Acceptance Criteria\n- [ ]\n- [x] Done\n`);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdAcCheck("TASK-001", { json: true });
    spy.mockRestore();
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("Found 1");
  });

  it("reports unchecked AC items", () => {
    makeTaskFile("TASK-001", `# TASK-001: Test\n\n## Acceptance Criteria\n- [ ] Do something\n`);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdAcCheck("TASK-001", { json: true });
    spy.mockRestore();
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("Found 1");
  });

  it("reports duplicate AC sections", () => {
    makeTaskFile("TASK-001", `# TASK-001: Test\n\n## Acceptance Criteria\n- [x] One\n\n## Acceptance Criteria\n- [x] Two\n`);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdAcCheck("TASK-001", { json: true });
    spy.mockRestore();
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
  });

  it("scans all tasks when no taskId is provided", () => {
    makeTaskFile("TASK-001", `# TASK-001: Test\n\n## Goal\nDo something.\n`);
    makeTaskFile("TASK-002", `# TASK-002: Test\n\n## Acceptance Criteria\n- [ ] Do something\n`);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdAcCheck(undefined, { json: true });
    spy.mockRestore();
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("Found 2");
  });

  it("throws for non-existent task", () => {
    expect(() => cmdAcCheck("TASK-999")).toThrow(/not found/i);
  });
});
