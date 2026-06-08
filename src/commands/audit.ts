import { getRepoRoot } from "../util/paths.js";
import { readTaskAudit, summarizeTaskAudit, type TimelineEntry } from "../core/audit.js";
import { readTaskInvocations } from "../core/cli-audit.js";
import { logInfo, logHeader, logSub, logDivider } from "../util/logging.js";
import { successResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export function cmdAudit(taskId: string, opts: { json?: boolean }): void {
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);

  if (opts.json) {
    writeResult(successResult({
      command: "audit",
      taskId,
      guidance: `Audit for ${taskId}: ${events.length} event(s).`,
    }), opts.json);
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
    writeResult(successResult({
      command: "transcript",
      taskId,
      guidance: `Transcript for ${taskId}: ${events.length} event(s).`,
    }), opts.json);
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

  // Get CLI invocations for this task
  const invocations = readTaskInvocations(repoRoot, taskId);

  // Merge invocations into timeline entries
  const invocationEntries: TimelineEntry[] = invocations.map((inv) => ({
    timestamp: inv.timestamp,
    event: `cli.${inv.exitCode === 0 ? "completed" : "failed"}`,
    summary: `taskforge ${inv.command} ${inv.args.join(" ")}`,
    detail: inv.error ? `exit ${inv.exitCode}: ${inv.error}` : `exit ${inv.exitCode} (${inv.duration}ms)`,
  }));

  // Combine and sort all entries by timestamp
  const allEntries = [...summary.entries, ...invocationEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (opts.json) {
    writeResult(successResult({
      command: "timeline",
      taskId,
      guidance: `Timeline for ${taskId}: ${allEntries.length} events, ${invocations.length} CLI invocations.`,
    }), opts.json);
    return;
  }

  logHeader(`Timeline: ${taskId}`);

  if (allEntries.length === 0) {
    logInfo("No events found.");
    return;
  }

  logDivider();

  for (const entry of allEntries) {
    const time = entry.timestamp.slice(11, 19);
    const icon = entry.event.startsWith("cli.") ? "⚡" : getEventIcon(entry.event);
    const detail = entry.detail ? `  ${entry.detail}` : "";
    logInfo(`${time}  ${icon} ${entry.event}${detail}`);
  }

  logDivider();
  logInfo(`Duration: ${summary.durationMinutes ?? 0}m  |  Events: ${summary.totalEvents}  |  CLI Invocations: ${invocations.length}  |  Errors: ${summary.errorCount}`);
}
