import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { appendEvent, readEvents, eventLogEvent } from "../src/core/event-log.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-eventlog-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  const stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("event-log", () => {
  it("appends NDJSON line to per-task event file", () => {
    appendEvent("TASK-001", {
      ts: "2026-05-22T01:00:00Z",
      actor: "agent:implementer",
      event: "claimed",
      session: "abc123",
    });

    const events = readEvents("TASK-001");
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("claimed");
    expect(events[0].session).toBe("abc123");
  });

  it("reads multiple events in order", () => {
    appendEvent("TASK-001", { ts: "2026-05-22T01:00:00Z", actor: "agent", event: "claimed" });
    appendEvent("TASK-001", { ts: "2026-05-22T01:05:00Z", actor: "agent", event: "started" });
    appendEvent("TASK-001", { ts: "2026-05-22T02:00:00Z", actor: "agent", event: "done" });

    const events = readEvents("TASK-001");
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.event)).toEqual(["claimed", "started", "done"]);
  });

  it("returns empty array for non-existent event file", () => {
    const events = readEvents("TASK-999");
    expect(events).toEqual([]);
  });

  it("auto-creates events directory", () => {
    appendEvent("TASK-001", { ts: "2026-05-22T01:00:00Z", actor: "agent", event: "claimed" });
    const eventsDir = path.join(uniqueDir, "task-state", "events");
    expect(fs.existsSync(eventsDir)).toBe(true);
  });

  it("eventLogEvent helper adds ts and actor", () => {
    eventLogEvent("TASK-001", "claimed", { session: "sess1" });
    const events = readEvents("TASK-001");
    expect(events).toHaveLength(1);
    expect(events[0].ts).toBeTruthy();
    expect(events[0].actor).toBe("agent:implementer");
    expect(events[0].event).toBe("claimed");
    expect(events[0].session).toBe("sess1");
  });
});
