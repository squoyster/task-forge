import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdUpdate } from "../../src/commands/update.js";
import { parseTaskFile } from "../../src/core/task-store.js";
import { setRepoRoot } from "../../src/util/paths.js";

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "" }),
}));

vi.mock("simple-git", () => {
  const mockGit = {
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ files: [{ path: "TASK-001.md" }] }),
  };
  return { default: vi.fn(() => mockGit) };
});

let uniqueDir: string;
let repoDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-update-test-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function writeTask(id: string): string {
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, `---
id: ${id}
type: Task
status: Ready
priority: P2
---

# ${id}: Existing Task

## Goal
Current goal.

## Agent Notes
`, "utf-8");
  return filePath;
}

describe("cmdUpdate", () => {
  it("updates editable fields and canonical sections", async () => {
    writeTask("TASK-001");

    await cmdUpdate("TASK-001", {
      title: "Updated Task",
      priority: "P1",
      goal: "New goal.",
      acceptanceCriteria: "- [ ] Verified",
      json: true,
    });

    const updated = parseTaskFile(path.join(stateDir, "TASK-001.md"));
    expect(updated).not.toBeNull();
    expect(updated!.priority).toBe("P1");
    expect(updated!.body).toContain("# TASK-001: Updated Task");
    expect(updated!.body).toContain("## Acceptance Criteria");
    expect(updated!.body).toContain("- [ ] Verified");
    expect(updated!.spec_hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("rejects readonly fields from imported markdown", async () => {
    writeTask("TASK-001");

    const importPath = path.join(uniqueDir, "input.md");
    fs.writeFileSync(importPath, `---
status: Done
priority: P1
---

# TASK-001: Imported

## Goal
Imported goal.
`, "utf-8");

    await cmdUpdate("TASK-001", {
      fromFile: importPath,
      json: true,
    });

    const updated = parseTaskFile(path.join(stateDir, "TASK-001.md"));
    expect(updated!.priority).toBe("P2");
    expect(updated!.body).toContain("Existing Task");
  });
});
