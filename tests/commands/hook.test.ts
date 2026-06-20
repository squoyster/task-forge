import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import {
  runPreCommitLogic,
  runPrePushLogic,
  type PushRef,
} from "../../src/core/hook-logic.js";
import { cmdHook } from "../../src/commands/hook.js";
import type { GateStamp } from "../../src/core/gate-stamp.js";

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

const SHA = "a".repeat(40);
const ZERO = "0".repeat(40);
const SESSION = "abcdef1234"; // 10-char hex
const BRANCH = `agent/TASK-309-rewrite--${SESSION}`;

function taskRef(branch: string, sha: string = SHA): PushRef {
  return {
    local_ref: `refs/heads/${branch}`,
    local_sha: sha,
    remote_ref: `refs/heads/${branch}`,
    remote_sha: ZERO,
  };
}

function validStamp(sha: string = SHA): GateStamp {
  return {
    commit_sha: sha,
    gates: { typecheck: true, lint: true, build: true, test: true },
    timestamp: "2026-01-01T00:00:00Z",
    runner_session: SESSION,
  };
}

describe("runPreCommitLogic", () => {
  it("allows a clean commit on a feature branch", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-309-test"], tmp);
    fs.writeFileSync(path.join(tmp, "src.txt"), "x");
    await git(["add", "src.txt"], tmp);
    const r = await runPreCommitLogic(tmp);
    expect(r.ok).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks staged gate-stamp.json", async () => {
    const tmp = await makeRepo();
    await git(["checkout", "-q", "-b", "agent/TASK-309-test"], tmp);
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
    await git(["checkout", "-q", "-b", "agent/TASK-309-test"], tmp);
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
    await git(["checkout", "-q", "-b", "agent/TASK-309-test"], tmp);
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

describe("runPrePushLogic — protected branches & force-push", () => {
  it("blocks push to main", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [
      { local_ref: "refs/heads/main", local_sha: SHA, remote_ref: "refs/heads/main", remote_sha: SHA },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("main");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks push to task-state", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [
      { local_ref: "refs/heads/task-state", local_sha: SHA, remote_ref: "refs/heads/task-state", remote_sha: SHA },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("task-state");
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("runPrePushLogic — gate stamp", () => {
  it("blocks a task-branch push when no gate stamp exists", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef(BRANCH)], {
      readStamp: () => null,
      loadAssignee: () => SESSION, // ownership ok, isolating stamp failure
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("gate stamp");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks a task-branch push when stamp sha mismatches HEAD", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef(BRANCH, SHA)], {
      readStamp: () => validStamp("b".repeat(40)), // different sha
      loadAssignee: () => SESSION,
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("HEAD moved");
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("runPrePushLogic — branch ownership", () => {
  it("blocks when branch session != task assignee", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef(BRANCH)], {
      readStamp: () => validStamp(),
      loadAssignee: () => "othersession", // mismatch
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("assigned to");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("allows when stamp matches and branch session == task assignee", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef(BRANCH)], {
      readStamp: () => validStamp(),
      loadAssignee: () => SESSION, // match
    });
    expect(r.ok).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("fail-open when task has no assignee (unclaimed)", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef(BRANCH)], {
      readStamp: () => validStamp(),
      loadAssignee: () => null,
    });
    expect(r.ok).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("runPrePushLogic — non-task branches", () => {
  it("blocks a non-task branch not in allowedBranches", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef("feature/x")], {
      allowedBranches: [],
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.join("\n")).toContain("non-task branch");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("allows a non-task branch listed in allowedBranches", async () => {
    const tmp = await makeRepo();
    const r = await runPrePushLogic(tmp, [taskRef("feature/x")], {
      allowedBranches: ["feature/x"],
    });
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
