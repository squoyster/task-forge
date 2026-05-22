import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getRepoRoot,
  setRepoRoot,
  getTasksDir,
  getTaskStateDir,
  getTaskFilePath,
  getWorktreesDir,
  getWorktreePath,
  getTaskforgeDir,
  getCachePath,
  getConfigPath,
  getConfigJsonPath,
  makeBranchName,
} from "../src/util/paths.js";

beforeEach(() => {
  setRepoRoot("/test/repo");
});

afterEach(() => {
  setRepoRoot("");
});

describe("getRepoRoot / setRepoRoot", () => {
  it("returns the value set by setRepoRoot", () => {
    expect(getRepoRoot()).toBe("/test/repo");
  });

  it("falls back to process.cwd() when not set", () => {
    setRepoRoot("");
    expect(getRepoRoot()).toBe(process.cwd());
  });
});

describe("getTasksDir", () => {
  it("returns repoRoot/tasks", () => {
    expect(getTasksDir("/test/repo")).toBe("/test/repo/tasks");
  });
});

describe("getTaskStateDir", () => {
  it("returns parent/task-state relative to repo", () => {
    expect(getTaskStateDir("/test/repo")).toBe("/test/task-state");
  });

  it("resolves correctly for nested repo paths", () => {
    expect(getTaskStateDir("/a/b/repo")).toBe("/a/b/task-state");
  });
});

describe("getTaskFilePath", () => {
  it("returns the full path in the task-state directory", () => {
    expect(getTaskFilePath("/test/repo", "TASK-001")).toBe("/test/task-state/TASK-001.md");
  });
});

describe("getWorktreesDir", () => {
  it("returns parent/worktrees/<project>", () => {
    expect(getWorktreesDir("/test/repo")).toBe("/test/worktrees/repo");
  });
});

describe("getWorktreePath", () => {
  it("returns worktree path for a task ID", () => {
    expect(getWorktreePath("/test/repo", "TASK-001")).toBe("/test/worktrees/repo/TASK-001");
  });
});

describe("getTaskforgeDir", () => {
  it("returns repoRoot/.taskforge", () => {
    expect(getTaskforgeDir("/test/repo")).toBe("/test/repo/.taskforge");
  });
});

describe("getCachePath", () => {
  it("returns .taskforge/cache.json", () => {
    expect(getCachePath("/test/repo")).toBe("/test/repo/.taskforge/cache.json");
  });
});

describe("getConfigPath", () => {
  it("returns .taskforge/config.yaml", () => {
    expect(getConfigPath("/test/repo")).toBe("/test/repo/.taskforge/config.yaml");
  });
});

describe("getConfigJsonPath", () => {
  it("returns .taskforge/config.json", () => {
    expect(getConfigJsonPath("/test/repo")).toBe("/test/repo/.taskforge/config.json");
  });
});

describe("makeBranchName", () => {
  it("generates a branch name from id and title", () => {
    expect(makeBranchName("TASK-123", "Implement folder watcher")).toBe("agent/TASK-123-implement-folder-watcher");
  });

  it("strips special characters", () => {
    expect(makeBranchName("BUG-42", "Fix token refresh & retry!")).toBe("agent/BUG-42-fix-token-refresh-retry");
  });

  it("truncates slug to 40 chars", () => {
    const long = "a".repeat(100);
    const result = makeBranchName("TASK-999", long);
    expect(result.length).toBeLessThanOrEqual(55); // agent/ + TASK-999- + 40 slug chars
    expect(result.charAt(result.length - 1)).not.toBe("-");
  });

  it("lowercases the title", () => {
    expect(makeBranchName("TASK-001", "HELLO World")).toBe("agent/TASK-001-hello-world");
  });

it("handles empty title gracefully", () => {
    const result = makeBranchName("TASK-001", "");
    expect(result).toBe("agent/TASK-001");
  });
});