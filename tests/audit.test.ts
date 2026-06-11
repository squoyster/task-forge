import { describe, it, expect, afterEach, vi } from "vitest";
import {
  appendAuditEvent,
  appendTaskTranscript,
  readAudit,
  readTaskAudit,
  summarizeTaskAudit,
  createAuditEvent,
  createTaskEvent,
  validateJsonlFiles,
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

    const dir = path.join(tmp, ".taskforge", "runtime", "logs", "taskforge", "tasks", "TASK-001");
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

describe("validateJsonlFiles", () => {
  it("returns no issues for valid JSONL files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    appendAuditEvent(tmp, createAuditEvent("task.command.started"));

    const issues = validateJsonlFiles(tmp);
    expect(issues).toEqual([]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reports parse errors for invalid JSON", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const dir = path.join(tmp, ".taskforge", "runtime", "logs", "taskforge", "audit");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "events.jsonl"), "not valid json\n", "utf-8");

    const issues = validateJsonlFiles(tmp);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("parse_error");
    expect(issues[0].line).toBe(1);
    expect(issues[0].filePath).toContain("events.jsonl");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reports schema errors for invalid event structure", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const dir = path.join(tmp, ".taskforge", "runtime", "logs", "taskforge", "audit");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "events.jsonl"), '{"foo": "bar"}\n', "utf-8");

    const issues = validateJsonlFiles(tmp);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("schema_error");
    expect(issues[0].line).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reports correct line numbers for multiple errors", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const dir = path.join(tmp, ".taskforge", "runtime", "logs", "taskforge", "audit");
    fs.mkdirSync(dir, { recursive: true });
    const validEvent = JSON.stringify(createAuditEvent("task.command.started"));
    fs.writeFileSync(path.join(dir, "events.jsonl"), `${validEvent}\nbad line\n${validEvent}\nalso bad\n`, "utf-8");

    const issues = validateJsonlFiles(tmp);
    expect(issues).toHaveLength(2);
    expect(issues[0].line).toBe(2);
    expect(issues[1].line).toBe(4);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty for non-existent audit directory", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    const issues = validateJsonlFiles(tmp);
    expect(issues).toEqual([]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("finds JSONL files in nested task directories", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-audit-"));
    appendTaskTranscript(tmp, "TASK-001", createAuditEvent("task.command.started"));
    const taskDir = path.join(tmp, ".taskforge", "runtime", "logs", "taskforge", "tasks", "TASK-001");
    fs.appendFileSync(path.join(taskDir, "transcript.jsonl"), "corrupt\n", "utf-8");

    const issues = validateJsonlFiles(tmp);
    expect(issues).toHaveLength(1);
    expect(issues[0].filePath).toContain("transcript.jsonl");
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
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      chunks.push(args.map(String).join(" "));
    });

    try {
      cmdTimeline("TASK-001", { json: true });
      const output = JSON.parse(chunks[0]);
      expect(output.ok).toBe(true);
      expect(output.status).toBe("success");
      expect(output.context.taskId).toBe("TASK-001");
    } finally {
      spy.mockRestore();
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
