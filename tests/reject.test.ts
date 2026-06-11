import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cmdReject } from "../src/commands/reject.js";
import { setRepoRoot } from "../src/util/paths.js";
import { recordCliInvocation } from "../src/core/cli-audit.js";

vi.mock("../src/core/git.js", () => ({
  commitAndPushTaskState: vi.fn().mockResolvedValue(undefined),
}));

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-reject-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(id: string): string {
  const lines = [
    "---",
    `id: ${id}`,
    "type: Chore",
    "status: Verify",
    "priority: P2",
    "---",
    "",
    `# ${id}: Reject test`,
    "",
    "## Goal",
    "Do something.",
    "",
    "## Acceptance Criteria",
    "- [x] Do something",
    "",
    "## Agent Notes",
    "",
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

describe("cmdReject", () => {
  it("archives terminal audit history into agent notes", async () => {
    const repoRoot = path.join(uniqueDir, "repo");
    const filePath = makeTaskFile("TASK-010");

    recordCliInvocation(repoRoot, "reject", ["TASK-010"], {}, 0, 80, null);

    await cmdReject("TASK-010", "No longer relevant");

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("status: Rejected");
    expect(content).toContain("Task rejected: No longer relevant");
    expect(content).toContain("Terminal audit archived for Rejected.");
    expect(content).toContain("Commands observed: reject.");
  });
});
