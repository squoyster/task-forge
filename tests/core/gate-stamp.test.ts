import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import {
  writeGateStamp,
  readGateStamp,
  verifyGateStamp,
  stampPath,
  isCleanTree,
  headSha,
  type GateStamp,
} from "../../src/core/gate-stamp.js";

async function git(args: string[], cwd: string): Promise<void> {
  await execa("git", args, { cwd, reject: false });
}

async function makeRepo(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-gstamp-"));
  fs.writeFileSync(path.join(tmp, "README.md"), "# test\n");
  await git(["init", "-q"], tmp);
  await git(["config", "user.email", "test@test"], tmp);
  await git(["config", "user.name", "test"], tmp);
  await git(["add", "-A"], tmp);
  await git(["commit", "-q", "-m", "init"], tmp);
  return tmp;
}

describe("gate-stamp", () => {
  it("writeGateStamp + readGateStamp round-trip", async () => {
    const tmp = await makeRepo();
    const sha = await headSha(tmp);
    const stamp: GateStamp = {
      commit_sha: sha,
      gates: { typecheck: true, lint: true, build: true, test: true },
      timestamp: "2026-01-01T00:00:00Z",
      runner_session: "ses_test",
    };
    writeGateStamp(tmp, stamp);
    expect(fs.existsSync(stampPath(tmp))).toBe(true);
    const read = readGateStamp(tmp);
    expect(read).not.toBeNull();
    expect(read!.commit_sha).toBe(sha);
    expect(read!.gates.test).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("readGateStamp returns null when missing", async () => {
    const tmp = await makeRepo();
    expect(readGateStamp(tmp)).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("readGateStamp returns null for malformed JSON", async () => {
    const tmp = await makeRepo();
    fs.mkdirSync(path.join(tmp, ".taskforge"), { recursive: true });
    fs.writeFileSync(stampPath(tmp), "{not json");
    expect(readGateStamp(tmp)).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("verifyGateStamp: valid stamp matches sha + gates", () => {
    const stamp: GateStamp = {
      commit_sha: "abc123",
      gates: { typecheck: true, lint: true },
      timestamp: "t",
      runner_session: "s",
    };
    const r = verifyGateStamp(stamp, "abc123", ["typecheck", "lint"]);
    expect(r.valid).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("verifyGateStamp: sha mismatch is invalid", () => {
    const stamp: GateStamp = {
      commit_sha: "abc123",
      gates: { typecheck: true },
      timestamp: "t",
      runner_session: "s",
    };
    const r = verifyGateStamp(stamp, "def999", ["typecheck"]);
    expect(r.valid).toBe(false);
    expect(r.reasons[0]).toContain("HEAD moved");
  });

  it("verifyGateStamp: missing stamp is invalid", () => {
    const r = verifyGateStamp(null, "abc123", ["typecheck"]);
    expect(r.valid).toBe(false);
    expect(r.reasons[0]).toContain("No gate stamp");
  });

  it("verifyGateStamp: unpassed gate is invalid", () => {
    const stamp: GateStamp = {
      commit_sha: "abc123",
      gates: { typecheck: true },
      timestamp: "t",
      runner_session: "s",
    };
    const r = verifyGateStamp(stamp, "abc123", ["typecheck", "test"]);
    expect(r.valid).toBe(false);
    expect(r.reasons[0]).toContain("'test'");
  });

  it("isCleanTree: clean repo", async () => {
    const tmp = await makeRepo();
    const { clean, porcelain } = await isCleanTree(tmp);
    expect(clean).toBe(true);
    expect(porcelain).toBe("");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("isCleanTree: dirty repo", async () => {
    const tmp = await makeRepo();
    fs.writeFileSync(path.join(tmp, "dirty.txt"), "x");
    const { clean } = await isCleanTree(tmp);
    expect(clean).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("headSha returns a 40-char sha", async () => {
    const tmp = await makeRepo();
    const sha = await headSha(tmp);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
