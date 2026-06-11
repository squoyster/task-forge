import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdList, filterTasks } from "../../src/commands/list.js";
import { setRepoRoot } from "../../src/util/paths.js";
import type { ParsedTask } from "../../src/core/task-store.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-list-test-"));
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
): void {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body =
    (bodyOverride as string | undefined) ??
    `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n`;
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

describe("filterTasks", () => {
  function makeTask(overrides: Partial<ParsedTask> = {}): ParsedTask {
    const id = overrides.id ?? "TASK-001";
    return {
      id,
      type: "Task",
      status: "Ready",
      priority: "P2",
      riskLevel: "Low",
      humanInterventionRequired: false,
      body: `# ${id}: Test task ${id}\n\n## Goal\nSomething.\n`,
      filePath: `/tmp/tasks/${id}.md`,
      ...overrides,
    };
  }

  it("returns all tasks when no filters", () => {
    const tasks = [
      makeTask({ id: "TASK-001" }),
      makeTask({ id: "TASK-002" }),
    ];
    expect(filterTasks(tasks, {})).toHaveLength(2);
  });

  it("filters by status", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Ready" }),
      makeTask({ id: "TASK-002", status: "Done" }),
      makeTask({ id: "TASK-003", status: "In Progress" }),
    ];
    const result = filterTasks(tasks, { status: "Ready" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("TASK-001");
  });

  it("filters by priority", () => {
    const tasks = [
      makeTask({ id: "TASK-001", priority: "P0" }),
      makeTask({ id: "TASK-002", priority: "P2" }),
    ];
    const result = filterTasks(tasks, { priority: "P0" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("TASK-001");
  });

  it("filters by type", () => {
    const tasks = [
      makeTask({ id: "TASK-001", type: "Task" }),
      makeTask({ id: "BUG-001", type: "Bug" }),
    ];
    const result = filterTasks(tasks, { type: "Bug" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("BUG-001");
  });

  it("filters by search in ID", () => {
    const tasks = [
      makeTask({ id: "TASK-001" }),
      makeTask({ id: "TASK-002" }),
    ];
    const result = filterTasks(tasks, { search: "001" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("TASK-001");
  });

  it("filters by search in body", () => {
    const tasks = [
      makeTask({ id: "TASK-001", body: "# TASK-001: Auth feature\n\n## Goal\nLogin.\n" }),
      makeTask({ id: "TASK-002", body: "# TASK-002: Payment\n\n## Goal\nCheckout.\n" }),
    ];
    const result = filterTasks(tasks, { search: "auth" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("TASK-001");
  });

  it("combines filters with AND logic", () => {
    const tasks = [
      makeTask({ id: "TASK-001", status: "Ready", priority: "P0" }),
      makeTask({ id: "TASK-002", status: "Ready", priority: "P2" }),
      makeTask({ id: "TASK-003", status: "Done", priority: "P0" }),
    ];
    const result = filterTasks(tasks, { status: "Ready", priority: "P0" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("TASK-001");
  });

  it("returns empty when no tasks match", () => {
    const tasks = [makeTask({ id: "TASK-001", status: "Done" })];
    expect(filterTasks(tasks, { status: "Ready" })).toEqual([]);
  });

  it("is case-insensitive for search", () => {
    const tasks = [
      makeTask({ id: "TASK-001", body: "# TASK-001: Hello World\n" }),
    ];
    expect(filterTasks(tasks, { search: "HELLO" })).toHaveLength(1);
    expect(filterTasks(tasks, { search: "world" })).toHaveLength(1);
  });
});

describe("cmdList", () => {
  it("shows message when no tasks", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No tasks"));
    logSpy.mockRestore();
  });

  it("lists all tasks without filters", async () => {
    makeTaskFile("TASK-001");
    makeTaskFile("TASK-002");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-001"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    logSpy.mockRestore();
  });

  it("filters by status flag", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    makeTaskFile("TASK-002", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList({ status: "Done" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("TASK-001"));
    logSpy.mockRestore();
  });

  it("outputs JSON with --json flag", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });
    makeTaskFile("TASK-002", { status: "Done" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList({ json: true });
    const jsonArg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonArg);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.data.total).toBe(2);
    expect(parsed.data.tasks.map((t: { id: string }) => t.id)).toEqual(["TASK-001", "TASK-002"]);
    logSpy.mockRestore();
  });

  it("outputs empty array as JSON when no tasks", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList({ json: true });
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
    expect(parsed.data.total).toBe(0);
    expect(parsed.data.tasks).toEqual([]);
    logSpy.mockRestore();
  });

  it("filters by search flag", async () => {
    makeTaskFile("TASK-001");
    makeTaskFile("TASK-002", {
      body: "# TASK-002: Payment processing\n\n## Goal\nHandle payments.\n",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList({ search: "payment" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TASK-002"));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("TASK-001"));
    logSpy.mockRestore();
  });

  it("shows count in header", async () => {
    makeTaskFile("TASK-001");
    makeTaskFile("TASK-002");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdList();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("(2)"));
    logSpy.mockRestore();
  });
});
