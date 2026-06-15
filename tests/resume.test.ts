import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot } from "../src/util/paths.js";

// Mock all external modules used by resume.ts
vi.mock("../src/core/session-state.js", () => ({
  readSessionState: vi.fn(),
}));

vi.mock("../src/core/git.js", () => ({
  checkWorktreeBehindMain: vi.fn(),
}));

vi.mock("../src/core/task-store.js", () => ({
  loadTaskById: vi.fn(),
  loadAllTasks: vi.fn(),
}));

import { cmdResume } from "../src/commands/resume.js";
import { checkWorktreeBehindMain } from "../src/core/git.js";
import { loadTaskById } from "../src/core/task-store.js";
import { readSessionState } from "../src/core/session-state.js";

// Re-assignable refs set up fresh per test
let uniqueDir: string;
let worktreePath: string;
let repoDir: string;

const validMockTask = (wt: string) => ({
  id: "TASK-001",
  title: "Test task",
  status: "In Progress",
  branch: "agent/TASK-001-test",
  worktree: wt,
});

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-resume-test-"));
  repoDir = path.join(uniqueDir, "repo");
  const stateDir = path.resolve(repoDir, "..", "task-state");
  worktreePath = path.join(uniqueDir, "worktrees", "repo", "TASK-001");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
  // Set default mock return value for session-state after clearAllMocks.
  // IMPORTANT: recoverBySessionFile uses snake_case keys from session state
  vi.mocked(readSessionState).mockReturnValue({
    task_id: "TASK-001",
    session_id: "ses_test123",
    worktree_path: worktreePath,
    claimed_at: new Date().toISOString(),
  });
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdResume behind-main warning", () => {
  it("shows warning when worktree branch is behind origin/main", async () => {
    // Session file based recovery: the computed worktree path matches a real
    // .taskforge-session.json file on disk, and readSessionState reads it back.
    fs.mkdirSync(worktreePath, { recursive: true });
    fs.writeFileSync(
      path.join(worktreePath, ".taskforge-session.json"),
      JSON.stringify({ taskId: "TASK-001", sessionId: "ses_test123" }),
    );

    // loadTaskById returns the task so the resume flow can read task.branch
    vi.mocked(loadTaskById).mockReturnValue(validMockTask(worktreePath));
    vi.mocked(checkWorktreeBehindMain).mockResolvedValue({ behind: true, count: 3 });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await cmdResume("TASK-001");

    expect(vi.mocked(checkWorktreeBehindMain)).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("behind"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("3"));
    warnSpy.mockRestore();
  });

  it("does not show warning when branch is up to date", async () => {
    fs.mkdirSync(worktreePath, { recursive: true });
    fs.writeFileSync(
      path.join(worktreePath, ".taskforge-session.json"),
      JSON.stringify({ taskId: "TASK-001", sessionId: "ses_test123" }),
    );

    vi.mocked(loadTaskById).mockReturnValue(validMockTask(worktreePath));
    vi.mocked(checkWorktreeBehindMain).mockResolvedValue({ behind: false, count: 0 });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await cmdResume("TASK-001");

    expect(vi.mocked(checkWorktreeBehindMain)).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("behind"));
    warnSpy.mockRestore();
  });
});
