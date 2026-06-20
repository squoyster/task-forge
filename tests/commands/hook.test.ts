import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import { runPreCommitLogic, runPrePushLogic } from "../../src/core/hook-logic.js";
import { cmdHook } from "../../src/commands/hook.js";

async function git(args: string[], cwd: string): Promise<void> {
  await execa("git", args, { cwd, reject: false });
}

async function makeRepo(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-hook-"));
  fs.writeFileSync(path.join(tmp, "README.md"), "# test\n");
  await git(["init", "-q"], tmp);
  await git(["config", "user.email", "test@test"], tmp);
  await git(["config", "user.name", "test"], tmp);
  await git(["add", "-A"], tmp);
  await git(["commit", "-q", "-m", "init"], tmp);
  return tmp;
}

async function headSha(cwd: string): Promise<string> {
  return (await execa("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();
}

describe("runPreCommitLogic", () => {
  it("allows a clean commit on a feature branch", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-308-test"], tmp);
    fs.writeFileSync(path.join(tmp, "src.txt"), "x");
    await git(["add", "src.txt"], tmp);
    const r = await runPreCommitLogic(tmp);
    expect(r.ok).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks staged gate-stamp.json", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-308-test"], tmp);
    fs.mkdirSync(path.join(tmp, ".taskforge"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".taskforge", "gate-stamp.json"), "{}");
    await git(["add", ".taskforge/gate-stamp.json"], tmp);
    const r = await runPreCommitLogic(tmp);
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("gate-stamp.json");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks staged tasks/*.md", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-308-test"], tmp);
    fs.mkdirSync(path.join(tmp, "tasks"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "tasks", "TASK-1.md"), "# t");
    await git(["add", "tasks/TASK-1.md"], tmp);
    const r = await runPreCommitLogic(tmp);
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("tasks/*.md");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("TASKFORGE_INTERNAL bypasses checks", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-308-test"], tmp);
    fs.mkdirSync(path.join(tmp, ".taskforge"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".taskforge", "gate-stamp.json"), "{}");
    await git(["add", ".taskforge/gate-stamp.json"], tmp);
    process.env.TASKFORGE_INTERNAL = "1";
    try {
      const r = await runPreCommitLogic(tmp);
      expect(r.ok).toBe(true);
    } finally {
      delete process.env.TASKFORGE_INTERNAL;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("runPrePushLogic", () => {
  it("blocks push to main", async () => {
    const tmp = await makeRepo();
    const sha = await headSha(tmp);
    const r = await runPrePushLogic(tmp, [
      {
        local_ref: "refs/heads/main",
        local_sha: sha,
        remote_ref: "refs/heads/main",
        remote_sha: sha,
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("main");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks push to task-state", async () => {
    const tmp = await makeRepo();
    const sha = await headSha(tmp);
    const r = await runPrePushLogic(tmp, [
      {
        local_ref: "refs/heads/task-state",
        local_sha: sha,
        remote_ref: "refs/heads/task-state",
        remote_sha: sha,
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("task-state");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("allows a new task-branch push (remote zero = new branch)", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-308-test"], tmp);
    const sha = await headSha(tmp);
    const r = await runPrePushLogic(tmp, [
      {
        local_ref: "refs/heads/agent/TASK-308-test",
        local_sha: sha,
        remote_ref: "refs/heads/agent/TASK-308-test",
        remote_sha: "0".repeat(40),
      },
    ]);
    expect(r.ok).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("cmdHook", () => {
  it("unknown hook returns false", async () => {
    const ok = await cmdHook("nope", { json: false });
    expect(ok).toBe(false);
  });
});
