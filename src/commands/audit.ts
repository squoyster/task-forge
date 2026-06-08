import { getRepoRoot } from "../util/paths.js";
import { readTaskAudit, summarizeTaskAudit } from "../core/audit.js";
import { logInfo, logHeader, logSub, logDivider } from "../util/logging.js";
import { successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";

export function cmdAudit(taskId: string, opts: { json?: boolean }): void {
  const start = Date.now();
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, events }, null, 2) + "\n");
    return;
  }

  const result = events.length === 0
    ? noopResult({
        command: "audit",
        reason: "No audit events found.",
        nextCommands: getValidNextCommands("audit", "success"),
        duration: Date.now() - start,
      })
    : successResult({
        command: "audit",
        guidance: `Audit: ${taskId} (${events.length} event(s))`,
        nextCommands: getValidNextCommands("audit", "success"),
        duration: Date.now() - start,
      });

  logHeader(`Audit: ${taskId}`);
  if (events.length === 0) {
    logInfo("No audit events found.");
  } else {
    for (const event of events) {
      logSub(`${event.timestamp} [${event.event}]`);
      if (event.summary) logInfo(`  ${event.summary}`);
    }
  }
  process.stdout.write(renderResultMarkdown(result) + "\n");
}

export function cmdTranscript(taskId: string, opts: { json?: boolean }): void {
  const start = Date.now();
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, events }, null, 2) + "\n");
    return;
  }

  const result = events.length === 0
    ? noopResult({
        command: "transcript",
        reason: "No transcript events found.",
        nextCommands: getValidNextCommands("transcript", "success"),
        duration: Date.now() - start,
      })
    : successResult({
        command: "transcript",
        guidance: `Transcript: ${taskId} (${events.length} event(s))`,
        nextCommands: getValidNextCommands("transcript", "success"),
        duration: Date.now() - start,
      });

  logHeader(`Transcript: ${taskId}`);
  if (events.length === 0) {
    logInfo("No transcript events found.");
  } else {
    for (const event of events) {
      const time = event.timestamp.slice(11, 19);
      const label = event.summary ?? event.event;
      logInfo(`[${time}] ${label}`);
    }
  }
  process.stdout.write(renderResultMarkdown(result) + "\n");
}

function getEventIcon(eventType: string): string {
  if (eventType.includes("started") || eventType.includes("created")) return "\u25B6";
  if (eventType.includes("completed") || eventType.includes("released")) return "\u2714";
  if (eventType.includes("failed") || eventType.includes("error")) return "\u2718";
  return "\u2503";
}

export function cmdTimeline(taskId: string, opts: { json?: boolean } = {}): void {
  const start = Date.now();
  const repoRoot = getRepoRoot();
  const summary = summarizeTaskAudit(repoRoot, taskId);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, ...summary }, null, 2) + "\n");
    return;
  }

  const result = summary.entries.length === 0
    ? noopResult({
        command: "timeline",
        reason: "No events found.",
        nextCommands: getValidNextCommands("timeline", "success"),
        duration: Date.now() - start,
      })
    : successResult({
        command: "timeline",
        guidance: `Timeline: ${taskId} (${summary.totalEvents} events, ${summary.durationMinutes ?? 0}m)`,
        nextCommands: getValidNextCommands("timeline", "success"),
        duration: Date.now() - start,
      });

  logHeader(`Timeline: ${taskId}`);

  if (summary.entries.length === 0) {
    logInfo("No events found.");
  } else {
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
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
