import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdBlock } from "../../src/commands/block.js";
import { setRepoRoot } from "../../src/util/paths.js";

let tmpDir: string;
let tasksDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-block-test-"));
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
  bodyFromParam?: string,
): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "In Progress",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = bodyFromParam ?? (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(tasksDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

describe("cmdBlock", () => {
  it("marks a task as blocked with a reason", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdBlock("TASK-001", "Waiting on external dependency");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Blocked");
    expect(content).toContain("Waiting on external dependency");
  });

  it("throws for non-existent task", async () => {
    await expect(cmdBlock("TASK-999", "reason")).rejects.toThrow(/not found/i);
  });

  it("throws for invalid transition from Done", async () => {
    makeTaskFile("TASK-001", { status: "Done" });
    await expect(cmdBlock("TASK-001", "reason")).rejects.toThrow(/cannot transition/i);
  });

  it("logs success with reason", async () => {
    makeTaskFile("TASK-001");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdBlock("TASK-001", "Blocked reason");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Blocked reason"));
    logSpy.mockRestore();
  });

  it("appends agent note with block reason", async () => {
    const fp = makeTaskFile(
      "TASK-001",
      {},
      `# TASK-001: Test\n\n## Goal\nTest\n\n## Agent Notes\n`,
    );
    await cmdBlock("TASK-001", "Blocking reason");
    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Agent Notes");
    expect(content).toContain("Task blocked: Blocking reason");
  });
});
