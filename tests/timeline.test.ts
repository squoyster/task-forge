import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { summarizeTaskAudit, appendTaskTranscript, createAuditEvent } from "../src/core/audit.js";
import { cmdTimeline } from "../src/commands/audit.js";
import { setRepoRoot } from "../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;
let repoDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-timeline-test-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTranscript(taskId: string, events: Array<Partial<Parameters<typeof createAuditEvent>[1]>>): void {
  for (const e of events) {
    const event = createAuditEvent(e.event as any, { taskId, ...e });
    appendTaskTranscript(repoDir, taskId, event);
  }
}

describe("summarizeTaskAudit", () => {
  it("returns empty entries when no events exist", () => {
    makeTranscript("TASK-001", []);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.entries).toEqual([]);
    expect(summary.totalEvents).toBe(0);
  });

  it("builds entries with summary and detail", () => {
    makeTranscript("TASK-001", [
      { event: "task.command.started", summary: "Task claimed" },
      { event: "git.commit", summary: "feat: add validation", metadata: { message: "feat: add validation" } },
      { event: "task.command.completed", summary: "Marked Done" },
    ]);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.entries.length).toBe(3);
    expect(summary.entries[0].event).toBe("task.command.started");
    expect(summary.entries[0].summary).toBe("Task claimed");
    expect(summary.entries[1].detail).toBe("feat: add validation");
    expect(summary.entries[2].event).toBe("task.command.completed");
  });

  it("calculates duration in minutes", () => {
    const base = new Date("2026-05-25T01:00:00Z");
    const later = new Date("2026-05-25T01:30:00Z");
    makeTranscript("TASK-001", [
      { event: "task.command.started", timestamp: base.toISOString() },
      { event: "task.command.completed", timestamp: later.toISOString() },
    ]);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.durationMinutes).toBe(30);
  });

  it("extracts detail from git.push events", () => {
    makeTranscript("TASK-001", [
      { event: "git.push", metadata: { branch: "agent/TASK-001-test" } },
    ]);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.entries[0].detail).toBe("Pushed agent/TASK-001-test");
  });

  it("extracts detail from task.state.changed events", () => {
    makeTranscript("TASK-001", [
      { event: "task.state.changed", metadata: { from: "Ready", to: "In Progress" } },
    ]);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.entries[0].detail).toBe("Ready → In Progress");
  });

  it("extracts detail from file.edited events", () => {
    makeTranscript("TASK-001", [
      { event: "file.edited", metadata: { file: "src/commands/validate.ts", linesAdded: 42 } },
    ]);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.entries[0].detail).toBe("src/commands/validate.ts (+42)");
  });

  it("counts errors for failed events", () => {
    makeTranscript("TASK-001", [
      { event: "task.command.started" },
      { event: "verification.failed" },
      { event: "task.command.failed" },
    ]);
    const summary = summarizeTaskAudit(repoDir, "TASK-001");
    expect(summary.errorCount).toBe(2);
  });
});

describe("cmdTimeline", () => {
  it("shows enriched timeline with details", () => {
    makeTranscript("TASK-001", [
      { event: "task.command.started", summary: "Task claimed" },
      { event: "git.commit", summary: "feat: add validation", metadata: { message: "feat: add validation" } },
      { event: "task.command.completed", summary: "Marked Done" },
    ]);

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdTimeline("TASK-001");
    spy.mockRestore();

    const output = logs.join("\n");
    expect(output).toContain("task.command.started");
    expect(output).toContain("git.commit");
    expect(output).toContain("feat: add validation");
    expect(output).toContain("task.command.completed");
    expect(output).toContain("Duration:");
    expect(output).toContain("Events: 3");
  });

  it("outputs JSON with entries array", () => {
    makeTranscript("TASK-001", [
      { event: "task.command.started", summary: "Task claimed" },
    ]);

    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    });
    cmdTimeline("TASK-001", { json: true });
    spy.mockRestore();

    const output = JSON.parse(chunks[0]);
    expect(output.entries).toBeDefined();
    expect(output.entries.length).toBe(1);
    expect(output.durationMinutes).toBeDefined();
  });

  it("shows no events message when empty", () => {
    makeTranscript("TASK-001", []);

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    cmdTimeline("TASK-001");
    spy.mockRestore();

    const output = logs.join("\n");
    expect(output).toContain("No events found");
  });
});
