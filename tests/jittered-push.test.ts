import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot } from "../src/util/paths.js";

// Mock execa so we control push/pull behavior
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

// Mock simple-git commit/status/add to succeed
vi.mock("simple-git", () => {
  const mockGit = {
    add: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ files: ["TASK-001.md"] }),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: vi.fn(() => mockGit),
  };
});

import { execa } from "execa";
import { jitteredPush } from "../src/core/git.js";

let tmpDir: string;
let repoDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jittered-push-test-"));
  repoDir = path.join(tmpDir, "repo");
  // Create the task-state dir that getTaskStateDir will resolve
  const stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("jitteredPush", () => {
  it("succeeds on first push attempt", async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as any);

    const result = await jitteredPush(repoDir, "test: add task");

    expect(result).toBe(true);
    // Should have called push
    expect(execa).toHaveBeenCalledWith(
      "git",
      ["push", "origin", "task-state"],
      expect.objectContaining({ cwd: expect.stringContaining("task-state") }),
    );
  });

  it("retries on non-fast-forward rejection and succeeds", async () => {
    // First push fails (non-fast-forward), pull succeeds, retry push succeeds
    vi.mocked(execa)
      .mockRejectedValueOnce(new Error("Updates were rejected because [rejected] non-fast-forward"))
      .mockResolvedValueOnce({ exitCode: 0 } as any) // pull --rebase
      .mockResolvedValueOnce({ exitCode: 0 } as any); // retry push succeeds

    const result = await jitteredPush(repoDir, "test: retry", {
      maxRetries: 2,
      jitterMinMs: 1,
      jitterMaxMs: 2,
    });

    expect(result).toBe(true);
    // Should have called push (fail) + pull --rebase + push (succeed)
    expect(execa).toHaveBeenCalledTimes(3);
  });

  it("returns false after exhausting all retries", async () => {
    // All pushes fail with non-fast-forward
    vi.mocked(execa)
      .mockRejectedValueOnce(new Error("[rejected] non-fast-forward"))
      .mockResolvedValueOnce({ exitCode: 0 } as any) // pull --rebase
      .mockRejectedValueOnce(new Error("[rejected] non-fast-forward"))
      .mockResolvedValueOnce({ exitCode: 0 } as any) // pull --rebase
      .mockRejectedValueOnce(new Error("[rejected] non-fast-forward"));

    const result = await jitteredPush(repoDir, "test: exhaust", {
      maxRetries: 2,
      jitterMinMs: 1,
      jitterMaxMs: 2,
    });

    expect(result).toBe(false);
  });

  it("does not retry on non-push errors", async () => {
    // Push fails with a non-git error
    vi.mocked(execa).mockRejectedValueOnce(new Error("connection refused"));

    const result = await jitteredPush(repoDir, "test: no retry", {
      maxRetries: 3,
      jitterMinMs: 1,
      jitterMaxMs: 2,
    });

    expect(result).toBe(false);
    // Only one push attempt — no retry because it's not a fast-forward error
    expect(execa).toHaveBeenCalledTimes(1);
  });

  it("calls onConflict callback and aborts when it returns false", async () => {
    const onConflict = vi.fn().mockResolvedValue(false);

    vi.mocked(execa)
      .mockRejectedValueOnce(new Error("[rejected] non-fast-forward"))
      .mockResolvedValueOnce({ exitCode: 0 } as any); // pull --rebase

    const result = await jitteredPush(repoDir, "test: onConflict abort", {
      maxRetries: 3,
      jitterMinMs: 1,
      jitterMaxMs: 2,
      onConflict,
    });

    expect(result).toBe(false);
    expect(onConflict).toHaveBeenCalledTimes(1);
    // push (fail) + pull --rebase — no retry because onConflict returned false
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it("calls onConflict callback and retries when it returns true", async () => {
    const onConflict = vi.fn().mockResolvedValue(true);

    vi.mocked(execa)
      .mockRejectedValueOnce(new Error("[rejected] non-fast-forward"))
      .mockResolvedValueOnce({ exitCode: 0 } as any) // pull --rebase
      .mockResolvedValueOnce({ exitCode: 0 } as any); // retry push succeeds

    const result = await jitteredPush(repoDir, "test: onConflict retry", {
      maxRetries: 3,
      jitterMinMs: 1,
      jitterMaxMs: 2,
      onConflict,
    });

    expect(result).toBe(true);
    expect(onConflict).toHaveBeenCalledTimes(1);
    // push (fail) + pull --rebase + push (succeed)
    expect(execa).toHaveBeenCalledTimes(3);
  });

  it("returns true when no changes to push", async () => {
    // No changed files
    const { default: simpleGit } = await import("simple-git");
    const mockGit = simpleGit();
    vi.mocked(mockGit.status).mockResolvedValue({ files: [] } as any);

    const result = await jitteredPush(repoDir, "test: no changes");

    expect(result).toBe(true);
    expect(mockGit.commit).not.toHaveBeenCalled();
  });

  it("returns true when task-state directory does not exist", async () => {
    // Use a completely different base dir so getTaskStateDir resolves to a non-existent path
    const isolatedDir = path.join(tmpDir, "isolated", "deep", "repo");
    setRepoRoot(isolatedDir);
    // The resolved ../task-state won't exist

    const result = await jitteredPush(isolatedDir, "test: no dir");

    expect(result).toBe(true);
    expect(execa).not.toHaveBeenCalled();
  });
});