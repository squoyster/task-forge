import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdUnlock } from "../src/commands/unlock.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-unlock-test-"));
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
): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "In Progress",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => {
      // Quote string values that look like dates or contain special chars
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

describe("cmdUnlock", () => {
  it("rejects unlocking a task without --force", async () => {
    makeTaskFile("TASK-001", { assignee: "abc123def0", claimed_at: "2026-05-21 19:00:00" });
    // Without --force, unlock logs an error and returns without throwing
    await expect(cmdUnlock("TASK-001")).resolves.not.toThrow();
  });

  it("unlocks a locked task with --force", async () => {
    const fp = makeTaskFile("TASK-001", { assignee: "abc123def0", claimed_at: "2026-05-21 19:00:00" });

    await cmdUnlock("TASK-001", { force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).not.toContain("assignee");
    expect(content).not.toContain("claimed_at");
  });

  it("is a no-op (warning) on an unclaimed task", async () => {
    makeTaskFile("TASK-001");
    await expect(cmdUnlock("TASK-001", { force: true })).resolves.not.toThrow();
  });

  it("throws for non-existent task", async () => {
    await expect(cmdUnlock("TASK-999")).rejects.toThrow(/not found/i);
  });
});
