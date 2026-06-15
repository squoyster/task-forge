import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot } from "../src/util/paths.js";

// Mock execa so we control git command output
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
import { getBranchCommitsBehind, checkWorktreeBehindMain } from "../src/core/git.js";

let tmpDir: string;
let repoDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-test-"));
  repoDir = path.join(tmpDir, "repo");
  const stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(repoDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("getBranchCommitsBehind", () => {
  it("returns 0 when branch is up to date with remote", async () => {
    vi.mocked(execa).mockResolvedValue({ stdout: "0" } as any);
    const result = await getBranchCommitsBehind(repoDir, "agent/TASK-001");
    expect(result).toBe(0);
  });

  it("returns positive count when branch is behind remote", async () => {
    vi.mocked(execa).mockResolvedValue({ stdout: "3" } as any);
    const result = await getBranchCommitsBehind(repoDir, "agent/TASK-001");
    expect(result).toBe(3);
  });

  it("returns 0 when remote branch does not exist (git error)", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("fatal: ambiguous argument"));
    const result = await getBranchCommitsBehind(repoDir, "agent/TASK-001");
    expect(result).toBe(0);
  });
});

describe("checkWorktreeBehindMain", () => {
  it("returns behind=true when commits behind origin/main", async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce({ stdout: "" } as any)  // fetch
      .mockResolvedValueOnce({ stdout: "5" } as any); // rev-list
    const result = await checkWorktreeBehindMain(repoDir, repoDir, "agent/TASK-001");
    expect(result.behind).toBe(true);
    expect(result.count).toBe(5);
  });

  it("returns behind=false when up to date", async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce({ stdout: "" } as any)
      .mockResolvedValueOnce({ stdout: "0" } as any);
    const result = await checkWorktreeBehindMain(repoDir, repoDir, "agent/TASK-001");
    expect(result.behind).toBe(false);
    expect(result.count).toBe(0);
  });

  it("returns behind=false on git error (e.g. no remote)", async () => {
    vi.mocked(execa)
      .mockRejectedValueOnce(new Error("fatal: not a git repository"));
    const result = await checkWorktreeBehindMain(repoDir, repoDir, "agent/TASK-001");
    expect(result.behind).toBe(false);
    expect(result.count).toBe(0);
  });
});
