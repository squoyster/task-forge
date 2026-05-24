import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdBlock } from "../../src/commands/block.js";
import { setRepoRoot } from "../../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-block-test-"));
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
  const filePath = path.join(stateDir, `${id}.md`);
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

  it("blocks from Ready status", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Ready" });
    await cmdBlock("TASK-001", "Planned work blocked");
    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Blocked");
  });

  it("sets block_category and blocked_by fields", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdBlock("TASK-001", "Need decision", {
      category: "human_decision",
      blockedBy: "human",
    });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("block_category: human_decision");
    expect(content).toContain("blocked_by: human");
    expect(content).toContain("blocked_since:");
    expect(content).toContain("blocked_reason: Need decision");
  });

  it("defaults block_category and blocked_by to unspecified", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdBlock("TASK-001", "Just a reason");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("block_category: unspecified");
    expect(content).toContain("blocked_by: unspecified");
  });

  it("includes category in agent note", async () => {
    const fp = makeTaskFile("TASK-001", {}, `# TASK-001: Test\n\n## Goal\nTest\n\n## Agent Notes\n`);
    await cmdBlock("TASK-001", "Need access", {
      category: "missing_secret",
    });
    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Task blocked [missing_secret]: Need access");
  });

  it("emits BLOCK_FOR_HUMAN next action in JSON mode", async () => {
    makeTaskFile("TASK-001");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdBlock("TASK-001", "Waiting on human decision", { json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.state).toBe("task_blocked");
    expect(output.nextAction?.kind).toBe("BLOCK_FOR_HUMAN");
    expect(output.nextAction?.stop).toBe(true);
    expect(output.nextAction?.instruction).toContain("TASK-001 blocked");
    expect(output.nextAction?.allowedCommands).toEqual(["taskforge unblock", "taskforge status", "taskforge summary"]);

    logSpy.mockRestore();
  });
});
