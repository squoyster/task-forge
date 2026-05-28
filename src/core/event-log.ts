import fs from "node:fs";
import path from "node:path";
import { getTaskStateDir, getRepoRoot } from "../util/paths.js";

export interface EventLogEntry {
  ts: string;
  actor: string;
  event: string;
  [key: string]: unknown;
}

function getEventsDir(repoRoot?: string): string {
  return path.join(getTaskStateDir(repoRoot ?? getRepoRoot()), "events");
}

function getEventLogPath(taskId: string, repoRoot?: string): string {
  return path.join(getEventsDir(repoRoot), `${taskId}.ndjson`);
}

export function appendEvent(taskId: string, event: EventLogEntry, repoRoot?: string): void {
  const eventsDir = getEventsDir(repoRoot);
  fs.mkdirSync(eventsDir, { recursive: true });

  const logPath = getEventLogPath(taskId, repoRoot);
  const line = JSON.stringify(event) + "\n";
  fs.appendFileSync(logPath, line, "utf-8");
}

export function readEvents(taskId: string, repoRoot?: string): EventLogEntry[] {
  const logPath = getEventLogPath(taskId, repoRoot);
  if (!fs.existsSync(logPath)) return [];

  const content = fs.readFileSync(logPath, "utf-8").trim();
  if (!content) return [];

  return content.split("\n").map((line) => JSON.parse(line));
}

export function eventLogEvent(
  taskId: string,
  eventName: string,
  extra: Record<string, unknown> = {},
  repoRoot?: string,
): void {
  appendEvent(taskId, {
    ts: new Date().toISOString(),
    actor: extra.sessionId ? `agent:${extra.sessionId}` : "agent:implementer",
    event: eventName,
    ...extra,
  }, repoRoot);
}
