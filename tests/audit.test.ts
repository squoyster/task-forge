import { describe, it, expect, afterEach } from "vitest";
import {
  appendAuditEvent,
  appendTaskTranscript,
  readAudit,
  readTaskAudit,
  summarizeTaskAudit,
  createAuditEvent,
  createTaskEvent,
} from "../src/core/audit.js";
import { cmdTimeline } from "../src/commands/audit.js";
import { setRepoRoot } from "../src/util/paths.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("audit service", () => {
  it("appends audit events to events.jsonl", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const event = createAuditEvent("task.command.started", { taskId: "TASK-001", summary: "start test" });
    appendAuditEvent(tmp, event);

    const events = readAudit(tmp);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("task.command.started");
    expect(events[0].taskId).toBe("TASK-001");
    expect(events[0].summary).toBe("start test");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("appends task transcript events", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const event = createAuditEvent("tool.execute.before", { taskId: "TASK-001", summary: "npm test" });
    appendTaskTranscript(tmp, "TASK-001", event);

    const events = readTaskAudit(tmp, "TASK-001");
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("npm test");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("readAudit returns empty array for non-existent file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const events = readAudit(tmp);
    expect(events).toEqual([]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("readTaskAudit returns empty array for non-existent task", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const events = readTaskAudit(tmp, "TASK-X");
    expect(events).toEqual([]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("summarizeTaskAudit produces correct summary", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("task.command.started"));
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("task.command.completed"));
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("verification.failed"));

    const summary = summarizeTaskAudit(tmp, "TASK-001");
    expect(summary.taskId).toBe("TASK-001");
    expect(summary.totalEvents).toBe(3);
    expect(summary.errorCount).toBe(1);
    expect(summary.eventCounts["task.command.started"]).toBe(1);
    expect(summary.eventCounts["task.command.completed"]).toBe(1);
    expect(summary.eventCounts["verification.failed"]).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("createTaskEvent includes taskId", () => {
    const event = createTaskEvent("TASK-042", "doctor.lock.created");
    expect(event.taskId).toBe("TASK-042");
    expect(event.event).toBe("doctor.lock.created");
    expect(event.timestamp).toBeDefined();
  });

  it("skips invalid JSONL lines gracefully", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("task.command.started", { summary: "ok" }));

    const dir = path.join(tmp, "logs", "taskforge", "tasks", "TASK-001");
    fs.appendFileSync(path.join(dir, "transcript.jsonl"), "not valid json\n", "utf-8");

    const events = readTaskAudit(tmp, "TASK-001");
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("ok");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("creates directories automatically", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const deep = path.join(tmp, "sub1", "sub2");
    appendAuditEvent(deep, createAuditEvent("task.command.started"));

    const events = readAudit(deep);
    expect(events).toHaveLength(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("cmdTimeline", () => {
  afterEach(() => {
    setRepoRoot(process.cwd());
  });

  it("outputs JSON when --json flag is set", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    setRepoRoot(tmp);
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("task.command.started"));
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("tool.execute"));

    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => { chunks.push(chunk); return true; };

    try {
      cmdTimeline("TASK-001", { json: true });
      const output = JSON.parse(chunks.join(""));
      expect(output.taskId).toBe("TASK-001");
      expect(output.totalEvents).toBe(2);
      expect(output.eventCounts).toHaveProperty("task.command.started", 1);
      expect(output.eventCounts).toHaveProperty("tool.execute", 1);
    } finally {
      process.stdout.write = originalWrite;
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
