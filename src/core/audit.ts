import fs from "node:fs";
import path from "node:path";
import { AuditEventSchema, type AuditEvent, type AuditEventType } from "./audit-schema.js";
import { logWarn } from "../util/logging.js";

const AUDIT_BASE = "logs/taskforge";

function auditDir(root: string): string {
  const dir = path.join(root, AUDIT_BASE, "audit");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function taskAuditDir(root: string, taskId: string): string {
  const dir = path.join(root, AUDIT_BASE, "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function appendAuditEvent(repoRoot: string, event: AuditEvent): void {
  const dir = auditDir(repoRoot);
  const filePath = path.join(dir, "events.jsonl");
  writeJsonl(filePath, event);
}

export function appendTaskTranscript(repoRoot: string, taskId: string, event: AuditEvent): void {
  const dir = taskAuditDir(repoRoot, taskId);
  const filePath = path.join(dir, "transcript.jsonl");
  writeJsonl(filePath, event);
}

export function readAudit(repoRoot: string): AuditEvent[] {
  const filePath = path.join(auditDir(repoRoot), "events.jsonl");
  return readJsonl(filePath);
}

export function readTaskAudit(repoRoot: string, taskId: string): AuditEvent[] {
  const filePath = path.join(taskAuditDir(repoRoot, taskId), "transcript.jsonl");
  return readJsonl(filePath);
}

export function summarizeTaskAudit(repoRoot: string, taskId: string): TaskAuditSummary {
  const events = readTaskAudit(repoRoot, taskId);
  const byType: Record<string, number> = {};
  let firstTimestamp = "";
  let lastTimestamp = "";
  let errorCount = 0;

  for (const event of events) {
    byType[event.event] = (byType[event.event] ?? 0) + 1;
    if (!firstTimestamp || event.timestamp < firstTimestamp) firstTimestamp = event.timestamp;
    if (!lastTimestamp || event.timestamp > lastTimestamp) lastTimestamp = event.timestamp;
    if (event.event.includes("failed") || event.event.includes("error")) errorCount++;
  }

  return {
    taskId,
    totalEvents: events.length,
    firstEvent: firstTimestamp,
    lastEvent: lastTimestamp,
    errorCount,
    eventCounts: byType,
  };
}

export interface TaskAuditSummary {
  taskId: string;
  totalEvents: number;
  firstEvent: string;
  lastEvent: string;
  errorCount: number;
  eventCounts: Record<string, number>;
}

export function createAuditEvent(
  event: AuditEventType,
  overrides?: Partial<AuditEvent>,
): AuditEvent {
  return {
    timestamp: new Date().toISOString(),
    event,
    ...overrides,
  };
}

export function createTaskEvent(
  taskId: string,
  event: AuditEventType,
  overrides?: Partial<AuditEvent>,
): AuditEvent {
  return createAuditEvent(event, { ...overrides, taskId });
}

function writeJsonl(filePath: string, event: AuditEvent): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(event) + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

function readJsonl(filePath: string): AuditEvent[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const events: AuditEvent[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      const result = AuditEventSchema.safeParse(parsed);
      if (result.success) {
        events.push(result.data);
      } else {
        logWarn(`Skipping invalid audit line: ${line.slice(0, 80)}...`);
      }
    } catch {
      logWarn(`Skipping unparseable audit line: ${line.slice(0, 80)}...`);
    }
  }
  return events;
}
