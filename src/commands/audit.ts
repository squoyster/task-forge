import { getRepoRoot } from "../util/paths.js";
import { readTaskAudit, readAudit, summarizeTaskAudit } from "../core/audit.js";
import type { AuditEvent } from "../core/audit-schema.js";
import { logInfo, logHeader, logSub, logSuccess } from "../util/logging.js";

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

export function cmdTimeline(taskId: string, opts: { json?: boolean }): void {
  const repoRoot = getRepoRoot();
  const summary = summarizeTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }

  logHeader(`Timeline: ${taskId}`);
  logInfo(`Total events: ${summary.totalEvents}`);
  logInfo(`From: ${summary.firstEvent || "N/A"}`);
  logInfo(`To:   ${summary.lastEvent || "N/A"}`);
  logInfo(`Errors: ${summary.errorCount}`);

  if (Object.keys(summary.eventCounts).length > 0) {
    logInfo("");
    logInfo("Event breakdown:");
    for (const [type, count] of Object.entries(summary.eventCounts)) {
      logSub(`${type}: ${count}`);
    }
  }
}
