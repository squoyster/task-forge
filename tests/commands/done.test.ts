import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdDone } from "../../src/commands/done.js";
import { setRepoRoot } from "../../src/util/paths.js";

let tmpDir: string;
let tasksDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-done-test-"));
  tasksDir = path.join(tmpDir, "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });
  setRepoRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Review",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
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

describe("cmdDone", () => {
  it("marks a task as Done", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdDone("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Done");
  });

  it("throws for non-existent task", async () => {
    await expect(cmdDone("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("accepts force flag for invalid transitions", async () => {
    const fp = makeTaskFile("TASK-001", { status: "In Progress" });
    await cmdDone("TASK-001", { force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Done");
  });

  it("throws for invalid transition without force", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    await expect(cmdDone("TASK-001")).rejects.toThrow(/cannot transition/i);
  });

  it("appends agent note when marking Done", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdDone("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Task marked Done");
  });
});
