import fs from "node:fs";
import path from "node:path";
import { AuditEventSchema, type AuditEvent, type AuditEventType } from "./audit-schema.js";
import { logWarn } from "../util/logging.js";

export const RUNTIME_AUDIT_BASE = path.join(".taskforge", "runtime", "logs", "taskforge");
export const LEGACY_AUDIT_BASE = path.join("logs", "taskforge");

function runtimeAuditDir(root: string): string {
  const dir = path.join(root, RUNTIME_AUDIT_BASE, "audit");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runtimeTaskAuditDir(root: string, taskId: string): string {
  const dir = path.join(root, RUNTIME_AUDIT_BASE, "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function legacyAuditDir(root: string): string {
  return path.join(root, LEGACY_AUDIT_BASE, "audit");
}

function legacyTaskAuditDir(root: string, taskId: string): string {
  return path.join(root, LEGACY_AUDIT_BASE, "tasks", taskId);
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function readJsonlFiles(filePaths: string[]): AuditEvent[] {
  return uniquePaths(filePaths).flatMap((filePath) => readJsonl(filePath));
}

function existingAuditBases(root: string): string[] {
  return uniquePaths([
    path.join(root, RUNTIME_AUDIT_BASE),
    path.join(root, LEGACY_AUDIT_BASE),
  ]).filter((dir) => fs.existsSync(dir));
}

export function appendAuditEvent(repoRoot: string, event: AuditEvent): void {
  const dir = runtimeAuditDir(repoRoot);
  const filePath = path.join(dir, "events.jsonl");
  writeJsonl(filePath, event);
}

export function appendTaskTranscript(repoRoot: string, taskId: string, event: AuditEvent): void {
  const dir = runtimeTaskAuditDir(repoRoot, taskId);
  const filePath = path.join(dir, "transcript.jsonl");
  writeJsonl(filePath, event);
}

export function readAudit(repoRoot: string): AuditEvent[] {
  return readJsonlFiles([
    path.join(runtimeAuditDir(repoRoot), "events.jsonl"),
    path.join(legacyAuditDir(repoRoot), "events.jsonl"),
  ]);
}

export function readTaskAudit(repoRoot: string, taskId: string): AuditEvent[] {
  return readJsonlFiles([
    path.join(runtimeTaskAuditDir(repoRoot, taskId), "transcript.jsonl"),
    path.join(legacyTaskAuditDir(repoRoot, taskId), "transcript.jsonl"),
  ]);
}

export function summarizeTaskAudit(repoRoot: string, taskId: string): TaskAuditSummary {
  const events = readTaskAudit(repoRoot, taskId);
  const byType: Record<string, number> = {};
  let firstTimestamp = "";
  let lastTimestamp = "";
  let errorCount = 0;
  const entries: TimelineEntry[] = [];

  for (const event of events) {
    byType[event.event] = (byType[event.event] ?? 0) + 1;
    if (!firstTimestamp || event.timestamp < firstTimestamp) firstTimestamp = event.timestamp;
    if (!lastTimestamp || event.timestamp > lastTimestamp) lastTimestamp = event.timestamp;
    if (event.event.includes("failed") || event.event.includes("error")) errorCount++;

    const detail = extractEventDetail(event);
    entries.push({
      timestamp: event.timestamp,
      event: event.event,
      summary: event.summary ?? event.event,
      detail,
    });
  }

  let durationMinutes: number | undefined;
  if (firstTimestamp && lastTimestamp) {
    const ms = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();
    durationMinutes = Math.round(ms / 60000);
  }

  return {
    taskId,
    totalEvents: events.length,
    firstEvent: firstTimestamp,
    lastEvent: lastTimestamp,
    errorCount,
    eventCounts: byType,
    entries,
    durationMinutes,
  };
}

function extractEventDetail(event: AuditEvent): string | undefined {
  const meta = event.metadata;
  if (!meta) return undefined;

  if (event.event === "git.commit" && typeof meta.message === "string") {
    return meta.message;
  }
  if (event.event === "git.push" && typeof meta.branch === "string") {
    return `Pushed ${meta.branch}`;
  }
  if (event.event === "task.state.changed" && typeof meta.from === "string" && typeof meta.to === "string") {
    return `${meta.from} → ${meta.to}`;
  }
  if (event.event === "file.edited" && typeof meta.file === "string") {
    const lines = meta.linesAdded ? ` (+${meta.linesAdded})` : "";
    return meta.file + lines;
  }
  if (event.event === "tool.execute" && typeof meta.tool === "string") {
    return meta.tool;
  }
  if (typeof meta.notes === "string") {
    return meta.notes;
  }
  return undefined;
}

export interface JsonlValidationIssue {
  filePath: string;
  line: number;
  content: string;
  reason: "parse_error" | "schema_error";
}

export function validateJsonlFiles(repoRoot: string): JsonlValidationIssue[] {
  const issues: JsonlValidationIssue[] = [];
  const baseDirs = existingAuditBases(repoRoot);

  if (baseDirs.length === 0) return issues;

  const jsonlFiles = uniquePaths(baseDirs.flatMap((baseDir) => findJsonlFiles(baseDir)));
  for (const filePath of jsonlFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const result = AuditEventSchema.safeParse(parsed);
        if (!result.success) {
          issues.push({
            filePath,
            line: i + 1,
            content: line.slice(0, 100),
            reason: "schema_error",
          });
        }
      } catch {
        issues.push({
          filePath,
          line: i + 1,
          content: line.slice(0, 100),
          reason: "parse_error",
        });
      }
    }
  }

  return issues;
}

function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonlFiles(fullPath));
    } else if (entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files;
}

export interface TimelineEntry {
  timestamp: string;
  event: string;
  summary: string;
  detail?: string;
}

export interface TaskAuditSummary {
  taskId: string;
  totalEvents: number;
  firstEvent: string;
  lastEvent: string;
  errorCount: number;
  eventCounts: Record<string, number>;
  entries: TimelineEntry[];
  durationMinutes?: number;
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
