import { getRepoRoot } from "../util/paths.js";
import { readTaskAudit, summarizeTaskAudit } from "../core/audit.js";
import { logInfo, logHeader, logSub, logDivider } from "../util/logging.js";

export function cmdAudit(taskId: string, opts: { json?: boolean }): void {
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify(events, null, 2) + "\n");
    return;
  }

  logHeader(`Audit: ${taskId}`);
  if (events.length === 0) {
    logInfo("No audit events found.");
    return;
  }

  for (const event of events) {
    logSub(`${event.timestamp} [${event.event}]`);
    if (event.summary) logInfo(`  ${event.summary}`);
  }
}

export function cmdTranscript(taskId: string, opts: { json?: boolean }): void {
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify(events, null, 2) + "\n");
    return;
  }

  logHeader(`Transcript: ${taskId}`);
  if (events.length === 0) {
    logInfo("No transcript events found.");
    return;
  }

  for (const event of events) {
    const time = event.timestamp.slice(11, 19);
    const label = event.summary ?? event.event;
    logInfo(`[${time}] ${label}`);
  }
}

function getEventIcon(eventType: string): string {
  if (eventType.includes("started") || eventType.includes("created")) return "\u25B6";
  if (eventType.includes("completed") || eventType.includes("released")) return "\u2714";
  if (eventType.includes("failed") || eventType.includes("error")) return "\u2718";
  return "\u2503";
}

export function cmdTimeline(taskId: string, opts: { json?: boolean } = {}): void {
  const repoRoot = getRepoRoot();
  const summary = summarizeTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }

  logHeader(`Timeline: ${taskId}`);

  if (summary.entries.length === 0) {
    logInfo("No events found.");
    return;
  }

  logDivider();

  for (const entry of summary.entries) {
    const time = entry.timestamp.slice(11, 19);
    const icon = getEventIcon(entry.event);
    const detail = entry.detail ? `  ${entry.detail}` : "";
    logInfo(`${time}  ${icon} ${entry.event}${detail}`);
  }

  logDivider();
  logInfo(`Duration: ${summary.durationMinutes ?? 0}m  |  Events: ${summary.totalEvents}  |  Errors: ${summary.errorCount}`);
}
