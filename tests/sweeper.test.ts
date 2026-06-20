import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { sweepStaleTasks } from "../src/core/sweeper.js";
import { setRepoRoot } from "../src/util/paths.js";
import { parseTaskFile } from "../src/core/task-store.js";
import { DEFAULT_CONFIG } from "../src/core/config.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-sweeper-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTask(
  id: string,
  opts: { status?: string; assignee?: string; claimedAt?: string } = {},
): string {
  const fm: string[] = [
    "---",
    `id: ${id}`,
    "type: Task",
    `status: ${opts.status ?? "Ready"}`,
    "priority: P2",
  ];
  if (opts.assignee) fm.push(`assignee: ${opts.assignee}`);
  if (opts.claimedAt) fm.push(`claimed_at: '${opts.claimedAt}'`);
  fm.push("---", "", `# ${id}`, "", "## Goal", "x", "", "## Agent Notes", "");
  const fp = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(fp, fm.join("\n"), "utf-8");
  return fp;
}

// now = 09:30:00 UTC; claimed_at values are parsed as UTC by parseClaimedAt.
const NOW = new Date("2026-06-20T09:30:00Z");

describe("sweep config defaults", () => {
  it("default threshold is 15 minutes and autoReclaim is on", () => {
    expect(DEFAULT_CONFIG.sweep?.staleThresholdMinutes).toBe(15);
    expect(DEFAULT_CONFIG.sweep?.autoReclaim).toBe(true);
  });
});

describe("sweepStaleTasks — reclaim", () => {
  it("reclaims a stale-claimed task (>threshold) to Ready and clears the claim", async () => {
    makeTask("TASK-1", { status: "In Progress", assignee: "ses_stale", claimedAt: "2026-06-20 09:00:00" }); // 30m old

    const result = await sweepStaleTasks(undefined, { commit: false, reclaim: true, now: NOW });

    expect(result.stale.map((s) => s.id)).toContain("TASK-1");
    expect(result.changed).toBe(1);

    const after = parseTaskFile(path.join(stateDir, "TASK-1.md"));
    expect(after?.status).toBe("Ready");
    expect(after?.assignee).toBeUndefined();
  });

  it("does not reclaim a fresh-claimed task (<threshold)", async () => {
    makeTask("TASK-2", { status: "In Progress", assignee: "ses_fresh", claimedAt: "2026-06-20 09:25:00" }); // 5m old

    const result = await sweepStaleTasks(undefined, { commit: false, reclaim: true, now: NOW });

    expect(result.stale.map((s) => s.id)).not.toContain("TASK-2");
    expect(result.changed).toBe(0);

    const after = parseTaskFile(path.join(stateDir, "TASK-2.md"));
    expect(after?.status).toBe("In Progress");
  });

  it("15-minute default boundary: 16m is stale, 14m is not", async () => {
    makeTask("TASK-A", { status: "In Progress", assignee: "s1", claimedAt: "2026-06-20 09:14:00" }); // 16m
    makeTask("TASK-B", { status: "In Progress", assignee: "s2", claimedAt: "2026-06-20 09:16:00" }); // 14m

    const result = await sweepStaleTasks(undefined, { commit: false, reclaim: true, now: NOW });
    const ids = result.stale.map((s) => s.id);

    expect(ids).toContain("TASK-A");
    expect(ids).not.toContain("TASK-B");
  });

  it("--reclaim forces Ready even when inspect reports commits ahead (skips review)", async () => {
    makeTask("TASK-3", { status: "In Progress", assignee: "s3", claimedAt: "2026-06-20 09:00:00" });

    const result = await sweepStaleTasks(undefined, {
      commit: false,
      reclaim: true,
      now: NOW,
      inspectTask: (async () => ({ dirty: false, aheadOfMain: 5 })) as never,
    });

    const entry = result.stale.find((s) => s.id === "TASK-3");
    expect(entry?.action).toBe("reset");
    const after = parseTaskFile(path.join(stateDir, "TASK-3.md"));
    expect(after?.status).toBe("Ready");
  });

  it("without --reclaim, commits-ahead goes to Review", async () => {
    makeTask("TASK-4", { status: "In Progress", assignee: "s4", claimedAt: "2026-06-20 09:00:00" });

    const result = await sweepStaleTasks(undefined, {
      commit: false,
      now: NOW,
      inspectTask: (async () => ({ dirty: false, aheadOfMain: 5 })) as never,
    });

    const entry = result.stale.find((s) => s.id === "TASK-4");
    expect(entry?.action).toBe("review");
  });

  it("respects a custom staleThresholdMs override over the config default", async () => {
    makeTask("TASK-5", { status: "In Progress", assignee: "s5", claimedAt: "2026-06-20 09:20:00" }); // 10m old

    // 10m is under the 15m default but over a 5m override.
    const result = await sweepStaleTasks(undefined, {
      commit: false,
      reclaim: true,
      now: NOW,
      staleThresholdMs: 5 * 60 * 1000,
    });

    expect(result.stale.map((s) => s.id)).toContain("TASK-5");
  });

  it("ignores tasks that are not In Progress", async () => {
    makeTask("TASK-6", { status: "Ready", assignee: "s6", claimedAt: "2026-06-20 09:00:00" });

    const result = await sweepStaleTasks(undefined, { commit: false, reclaim: true, now: NOW });

    expect(result.stale.map((s) => s.id)).not.toContain("TASK-6");
  });
});
