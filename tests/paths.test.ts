import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import {
  getRepoRoot,
  setRepoRoot,
  getTaskStateDir,
  getTaskFilePath,
  getWorktreesDir,
  getWorktreePath,
  getTaskforgeDir,
  getCachePath,
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

describe("getTaskStateDir", () => {
  it("resolves default ../task-state relative to repo (no config => default)", () => {
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
  it("resolves default ../worktrees/<repoName> (no config => default)", () => {
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

describe("getConfigJsonPath", () => {
  it("returns .taskforge/config.json", () => {
    expect(getConfigJsonPath("/test/repo")).toBe("/test/repo/.taskforge/config.json");
  });
});

// TF-SIMP-03: config-authoritative storage paths. Honored from main checkout
// and linked worktrees; non-default relative and absolute configs respected.
function makeGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-paths-"));
  execSync("git init -q", { cwd: dir });
  execSync('git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init', { cwd: dir });
  return dir;
}

function writeConfig(repoRoot: string, cfg: object): void {
  const dir = path.join(repoRoot, ".taskforge");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(cfg), "utf-8");
  setRepoRoot(repoRoot); // reset cache so new config is seen
}

describe("TF-SIMP-03 config-authoritative paths", () => {
  afterEach(() => {
    setRepoRoot("");
  });

  it("honors a non-default relative tasks.stateDir", () => {
    const repo = makeGitRepo();
    writeConfig(repo, { tasks: { stateDir: "../elsewhere-state" } });
    expect(getTaskStateDir(repo)).toBe(path.resolve(repo, "..", "elsewhere-state"));
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("honors an absolute tasks.stateDir", () => {
    const repo = makeGitRepo();
    writeConfig(repo, { tasks: { stateDir: "/abs/task-state" } });
    expect(getTaskStateDir(repo)).toBe("/abs/task-state");
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("honors a non-default relative worktrees.root", () => {
    const repo = makeGitRepo();
    writeConfig(repo, { worktrees: { root: "../custom-wt" } });
    expect(getWorktreesDir(repo)).toBe(path.resolve(repo, "..", "custom-wt", path.basename(repo)));
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("resolves identically from main checkout and a linked worktree (AC #3)", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "tf-equiv-"));
    const repoRaw = path.join(parent, "myrepo");
    fs.mkdirSync(repoRaw);
    execSync("git init -q", { cwd: repoRaw });
    execSync('git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init', { cwd: repoRaw });
    // Canonicalize: macOS tmpdir is a /var -> /private/var symlink; git resolves the
    // worktree's common-dir to the canonical form, so the main root must match.
    const repo = fs.realpathSync(repoRaw);
    writeConfig(repo, { tasks: { stateDir: "../task-state" }, worktrees: { root: "../worktrees" } });

    const mainState = getTaskStateDir(repo);
    const mainWt = getWorktreesDir(repo);

    // Create a real linked worktree
    const wtParent = path.join(parent, "worktrees", "myrepo");
    fs.mkdirSync(wtParent, { recursive: true });
    execSync(`git -C "${repo}" worktree add -q -b wt-branch "${path.join(wtParent, "TASK-X")}"`, { stdio: "pipe" });
    const linkedRoot = path.join(wtParent, "TASK-X");

    setRepoRoot(linkedRoot);
    expect(getTaskStateDir(linkedRoot)).toBe(mainState);
    expect(getWorktreesDir(linkedRoot)).toBe(mainWt);

    fs.rmSync(parent, { recursive: true, force: true });
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