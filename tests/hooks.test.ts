import { describe, it, expect } from "vitest";
import { installGitHooks, checkHooks } from "../src/core/hooks.js";
import { isExecutable } from "../src/core/templates.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("installGitHooks", () => {
  it("creates hook files when installHooks is true", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hooks-"));
    installGitHooks({ projectRoot: tmp, dryRun: false, installHooks: true });

    const hooksDir = path.join(tmp, ".taskforge", "hooks");
    expect(fs.existsSync(path.join(hooksDir, "pre-commit"))).toBe(true);
    expect(fs.existsSync(path.join(hooksDir, "pre-push"))).toBe(true);
    expect(fs.existsSync(path.join(hooksDir, "post-commit"))).toBe(true);

    const preCommit = fs.readFileSync(path.join(hooksDir, "pre-commit"), "utf-8");
    expect(preCommit).toContain("TaskForge managed pre-commit hook");
    expect(preCommit).toContain("task-state");

    const prePush = fs.readFileSync(path.join(hooksDir, "pre-push"), "utf-8");
    expect(prePush).toContain("TaskForge managed pre-push hook");
    expect(prePush).toContain("Force push is forbidden.");
    expect(prePush).toContain(
      '"$remote_sha" == "0000000000000000000000000000000000000000"',
    );
    expect(prePush).toContain(
      '"$local_sha" == "0000000000000000000000000000000000000000"',
    );

    const postCommit = fs.readFileSync(path.join(hooksDir, "post-commit"), "utf-8");
    expect(postCommit).toContain("git.jsonl");
    expect(postCommit).toContain(".taskforge/runtime/logs/taskforge/audit");

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("skips hooks when installHooks is false", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hooks-"));
    installGitHooks({ projectRoot: tmp, dryRun: false, installHooks: false });
    expect(fs.existsSync(path.join(tmp, ".taskforge", "hooks"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run does not write files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hooks-"));
    installGitHooks({ projectRoot: tmp, dryRun: true, installHooks: true });
    expect(fs.existsSync(path.join(tmp, ".taskforge", "hooks"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("hooks are executable after creation", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hooks-"));
    installGitHooks({ projectRoot: tmp, dryRun: false, installHooks: true });
    const hooksDir = path.join(tmp, ".taskforge", "hooks");
    expect(isExecutable(path.join(hooksDir, "pre-commit"))).toBe(true);
    expect(isExecutable(path.join(hooksDir, "pre-push"))).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("checkHooks", () => {
  it("reports issues when hooks are missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hooks-"));
    const result = checkHooks(tmp);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain("Missing hook");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reports ok when hooks exist and are executable", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hooks-"));
    installGitHooks({ projectRoot: tmp, dryRun: false, installHooks: true });
    const result = checkHooks(tmp);
    expect(result.ok).toBe(true);
    expect(result.issues.length).toBe(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
